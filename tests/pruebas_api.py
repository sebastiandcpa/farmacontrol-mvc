from pathlib import Path
import concurrent.futures
import datetime
import http.cookiejar
import json
import os
import time
import urllib.error
import urllib.request

BASE=os.environ.get('FARMACONTROL_URL','http://localhost:5188')
OUT=Path(__file__).resolve().parent
results=[]
today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).date()

class Client:
    def __init__(self):
        self.jar=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def call(self,path,data=None,headers=None):
        req=urllib.request.Request(BASE+path,data=None if data is None else json.dumps(data).encode(),headers=headers or {'Content-Type':'application/json','X-Farma-Request':'1'})
        try:
            with self.opener.open(req,timeout=35) as response:return response.status,json.load(response)
        except urllib.error.HTTPError as error:
            try: packet=json.load(error)
            except: packet={}
            return error.code,packet
    def login(self,email,password='Farma2026!'):
        code,data=self.call('/api/login',{'email':email,'password':password})
        assert code==200,(code,data)
    def state(self):
        code,data=self.call('/api/state'); assert code==200,(code,data); return data['state']
    def operation(self,action,data,expected=200):
        code,result=self.call('/api/operations/'+action,data); assert code==expected,(action,code,result); return result

def check(identifier,name,run):
    start=time.perf_counter()
    try:
        detail=run() or 'Resultado conforme a las aserciones.'
        results.append({'id':identifier,'caso':name,'estado':'Aprobado','obtenido':detail,'ms':round((time.perf_counter()-start)*1000,2)})
        print(identifier,'Aprobado',detail,flush=True)
    except Exception as error:
        results.append({'id':identifier,'caso':name,'estado':'Fallido','obtenido':str(error),'ms':round((time.perf_counter()-start)*1000,2)})
        print(identifier,'Fallido',str(error),flush=True)
        raise

anonymous=Client(); admin=Client(); caja=Client(); almacen=Client(); quimico=Client()
def anonymous_test():
    assert anonymous.call('/api/state')[0]==401
    assert anonymous.call('/api/operations/sale',{'clientId':1,'items':[]})[0]==401
    return 'Lectura y escritura sin sesión devuelven HTTP 401.'
check('API01','Acceso sin sesión',anonymous_test)
def invalid_login():
    assert anonymous.call('/api/login',{'email':'admin@farmacontrol.local','password':'incorrecta'})[0]==401
    return 'La contraseña incorrecta devuelve HTTP 401.'
check('API02','Contraseña incorrecta',invalid_login)
def accounts():
    for client,email in [(admin,'admin'),(caja,'caja'),(almacen,'almacen'),(quimico,'quimico')]:client.login(email+'@farmacontrol.local')
    assert any(cookie.name=='FarmaControl.Session' and any(k.lower()=='httponly' for k in cookie._rest) for cookie in admin.jar)
    return 'Cuatro roles autenticados y cookie HttpOnly recibida.'
check('API03','Acceso por roles',accounts)
def csrf():
    assert admin.call('/api/operations/client',{'name':'X'},headers={'Content-Type':'application/json'})[0]==403
    assert admin.call('/api/operations/client',{'name':'X'},headers={'Content-Type':'application/json','X-Farma-Request':'1','Origin':'https://otro.example'})[0]==403
    return 'Solicitud sin cabecera y origen ajeno devuelven HTTP 403.'
check('API04','Protección de solicitudes',csrf)
def authorization():
    for client,action in [(caja,'purchase'),(almacen,'sale'),(quimico,'user'),(admin,'recipe')]:client.operation(action,{},403)
    return 'Cuatro operaciones fuera del rol devuelven HTTP 403.'
check('API05','Autorización del servidor',authorization)
def privacy():
    assert all('hash' not in u and 'password' not in u for u in admin.state()['users'])
    data=almacen.state();assert data['recipes']==[] and all('doc' not in c and 'phone' not in c for c in data['clients'])
    return 'No se envían hashes y el almacenero no recibe recetas ni documentos de clientes.'
check('API06','Minimización de datos por rol',privacy)

fixture={}
def client_create():
    previous=admin.state(); doc=str(80000000+len(previous['clients']))
    payload={'docType':'DNI','doc':doc,'name':'Cliente Verificación 80','phone':'900000001'}
    result=caja.operation('client',payload);fixture['client']=next(c for c in result['state']['clients'] if c['doc']==doc)
    assert len(result['state']['clients'])==len(previous['clients'])+1
    return 'Cliente persistido en SQL Server con DNI '+doc+'.'
check('API07','Registro de cliente',client_create)
def client_validation():
    c=fixture['client']; before=len(admin.state()['clients'])
    caja.operation('client',{k:v for k,v in c.items() if k!='id'},409)
    caja.operation('client',{'name':'Inválido','docType':'DNI','doc':'12'},400)
    assert len(admin.state()['clients'])==before
    return 'DNI duplicado e inválido rechazados sin insertar filas.'
check('API08','Validación de documentos',client_validation)
def edit_client():
    c=fixture['client'];caja.operation('client',{**c,'phone':'900000002'})
    assert next(x for x in admin.state()['clients'] if x['id']==c['id'])['phone']=='900000002'
    return 'La segunda sesión recupera el teléfono actualizado desde SQL Server.'
check('API09','Edición y persistencia entre sesiones',edit_client)
def product_lot():
    marker=str(time.time_ns())[-9:]
    payload={'sku':'QA80-'+marker,'name':'Medicamento Verificación 80','category':'Verificación','presentation':'Unidad','price':4.25,'rx':False}
    packet=almacen.operation('product',payload); product=next(p for p in packet['state']['products'] if p['sku']==payload['sku']);fixture['product']=product
    packet=almacen.operation('lot',{'productId':product['id'],'code':'LOTE-'+marker,'expiry':str(today+datetime.timedelta(days=90)),'min':1})
    fixture['lot']=next(l for l in packet['state']['lots'] if l['productId']==product['id'])
    assert fixture['lot']['stock']==0
    return 'Medicamento y lote creados con stock inicial cero.'
check('API10','Catálogo y lote',product_lot)
def purchase():
    payload={'supplierId':1,'document':'QA80-'+str(time.time_ns())[-10:],'items':[{'lotId':fixture['lot']['id'],'qty':5,'price':2}]}
    fixture['purchase']=payload
    packet=almacen.operation('purchase',payload)
    assert next(l for l in packet['state']['lots'] if l['id']==fixture['lot']['id'])['stock']==5
    assert any(p['document']==payload['document'] and p['total']==10 for p in packet['state']['purchases'])
    return 'Compra de 5 unidades por S/ 10.00 y stock 0 a 5.'
check('API11','Compra transaccional',purchase)
def purchase_duplicate():
    almacen.operation('purchase',fixture['purchase'],409)
    assert next(l for l in admin.state()['lots'] if l['id']==fixture['lot']['id'])['stock']==5
    return 'Documento repetido rechazado y stock conservado en 5.'
check('API12','Compra duplicada sin cambios',purchase_duplicate)
def sale():
    packet=caja.operation('sale',{'clientId':fixture['client']['id'],'type':'BOLETA','items':[{'lotId':fixture['lot']['id'],'qty':2,'price':0.01}]})
    fixture['saleId']=packet['operationId']; sale=next(s for s in packet['state']['sales'] if s['id']==fixture['saleId'])
    assert sale['total']==8.5 and next(l for l in packet['state']['lots'] if l['id']==fixture['lot']['id'])['stock']==3
    return 'Venta de 2 unidades por S/ 8.50. El servidor ignora el precio adulterado.'
check('API13','Venta y precio del servidor',sale)
def rejected_sale():
    before=admin.state(); payload={'clientId':1,'type':'BOLETA','items':[{'lotId':fixture['lot']['id'],'qty':9999}]}
    caja.operation('sale',payload,400)
    after=admin.state(); assert len(after['sales'])==len(before['sales']) and after['lots']==before['lots'] and len(after['movements'])==len(before['movements'])
    caja.operation('sale',{**payload,'items':[{'lotId':fixture['lot']['id'],'qty':1},{'lotId':fixture['lot']['id'],'qty':1}]},400)
    return 'Stock insuficiente y lote repetido rechazados sin venta, detalle ni movimiento.'
check('API14','Rechazo y atomicidad',rejected_sale)
def recipe_validation():
    payload={'clientId':1,'type':'BOLETA','items':[{'lotId':4,'qty':1}]}
    caja.operation('sale',payload,400)
    caja.operation('sale',{**payload,'recipeId':2},400)
    caja.operation('sale',{**payload,'clientId':3,'recipeId':3},400)
    return 'Venta con receta ausente, de otro cliente y vencida rechazadas.'
check('API15','Validación de recetas en la venta',recipe_validation)
def recipe_registration():
    code='REC-QA80-'+str(time.time_ns())[-8:]
    packet=quimico.operation('recipe',{'clientId':fixture['client']['id'],'code':code,'prescriber':'Profesional de verificación','issued':str(today),'expiry':str(today+datetime.timedelta(days=7))})
    recipe=next(r for r in packet['state']['recipes'] if r['code']==code); assert recipe['userId']==4
    return 'Receta registrada por el químico farmacéutico con responsable persistido.'
check('API16','Registro de receta por profesional',recipe_registration)
def invoice():
    caja.operation('sale',{'clientId':1,'type':'FACTURA','items':[{'lotId':fixture['lot']['id'],'qty':1}]},400)
    return 'Factura interna para cliente sin RUC rechazada.'
check('API17','Documento requerido para factura',invoice)
def cancellation():
    packet=admin.operation('cancelSale',{'id':fixture['saleId']}); sale=next(s for s in packet['state']['sales'] if s['id']==fixture['saleId'])
    assert sale['status']=='ANULADA' and sale['cancelledBy']==1 and sale.get('cancelledAt')
    assert next(l for l in packet['state']['lots'] if l['id']==fixture['lot']['id'])['stock']==5
    admin.operation('cancelSale',{'id':fixture['saleId']},400)
    assert next(l for l in admin.state()['lots'] if l['id']==fixture['lot']['id'])['stock']==5
    return 'Stock 3 a 5, responsable y fecha registrados. Segunda anulación rechazada.'
check('API18','Anulación única y trazabilidad',cancellation)
def concurrency():
    lot=fixture['lot']['id']; payload={'clientId':1,'type':'BOLETA','items':[{'lotId':lot,'qty':5}]}
    def send(_):return caja.call('/api/operations/sale',payload)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor: packets=list(executor.map(send,range(2)))
    assert sorted(code for code,_ in packets)==[200,400],packets
    assert next(l for l in admin.state()['lots'] if l['id']==lot)['stock']==0
    winning=next(data for code,data in packets if code==200)
    admin.operation('cancelSale',{'id':winning['operationId']})
    return 'Dos ventas concurrentes de 5 unidades: una confirmada y una rechazada. Stock mínimo observado 0.'
check('API19','Concurrencia sin sobreventa',concurrency)
def sql_injection():
    caja.operation('client',{'docType':'OTR','doc':'QA'+str(time.time_ns())[-8:],'name':"Verificación ' ; DROP TABLE dbo.Cliente; --",'phone':''})
    assert len(admin.state()['clients'])>=7
    return 'La cadena SQL se almacena como texto y la tabla Cliente permanece accesible.'
check('API20','Parametrización SQL',sql_injection)
def self_disable():
    admin.operation('userToggle',{'id':1},400); assert admin.state()['users'][0]['active']
    return 'El administrador no puede desactivar su propia cuenta.'
check('API21','Protección de cuenta activa',self_disable)
def latency():
    times=[]
    for _ in range(10):
        start=time.perf_counter(); admin.state(); times.append((time.perf_counter()-start)*1000)
    return f'10 lecturas locales. Promedio {sum(times)/len(times):.1f} ms. Máximo {max(times):.1f} ms.'
check('API22','Tiempo de consulta local',latency)
def logout():
    assert caja.call('/api/logout',{})[0]==200 and caja.call('/api/state')[0]==401
    return 'Cerrar sesión invalida el acceso a la API en esa sesión.'
check('API23','Cierre de sesión',logout)

(OUT/'pruebas_api_resultados.json').write_text(json.dumps({'fecha':str(today),'base':BASE,'resultados':results,'fixture':fixture},ensure_ascii=False,indent=2),encoding='utf-8')
print('TOTAL',len(results),'APROBADAS',sum(r['estado']=='Aprobado' for r in results),flush=True)
