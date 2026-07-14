from bs4 import BeautifulSoup
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import Select
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.firefox_binary import FirefoxBinary
import pandas as pd
import time
import re
import gspread
from google.oauth2.credentials import Credentials

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
creds = Credentials.from_authorized_user_file("token.json", SCOPES)
SHEET_ID = "1gluTdiqSm_xKriTrrHJ1ij1kF-dPgaW4O6Ti4iCSXRs"
SHEET_NAME = "Autorizar"
SHEET_PRECOS = "Preços"
gc = gspread.service_account('credentials3.json')
spreadsheet = gc.open_by_key(SHEET_ID)
worksheet = spreadsheet.worksheet(SHEET_NAME)
tabelaPrecos = spreadsheet.worksheet(SHEET_PRECOS)


def getPlanilha(nomeAba):
    return nomeAba.get_all_records()

df = pd.DataFrame(getPlanilha(worksheet))
print(df)
ds = pd.DataFrame(getPlanilha(tabelaPrecos))
print(ds)

driver = webdriver.Chrome()
driver.maximize_window()
action = ActionChains(driver)
driver.get("https://saude.sulamericaseguros.com.br/prestador/login/")
#WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CLASS_NAME,'close-btn'))).click() 

time.sleep(1)

referenciado = "100000018677"
usuario = "MASTER"
senha = "lab@5886"

WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CLASS_NAME,'sas-box-lgpd-info-accept-btn'))).click()

try:
    reffield = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'code')))
    reffield.click()
    reffield.clear()
    reffield.send_keys(referenciado)

    userfield = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'user')))
    userfield.click()
    userfield.clear()
    userfield.send_keys(usuario)

    passfield = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'senha')))
    passfield.click()
    passfield.clear()
    passfield.send_keys(senha)

    WebDriverWait(driver, 1).until(EC.element_to_be_clickable((By.XPATH,'//*[@id="entrarLogin"]'))).click()

except:
    pass

time.sleep(1)
element = driver.find_element(By.XPATH,'//*[@id="nameCookie"]')
driver.execute_script('arguments[0].scrollIntoView(true);', element)

print('Tamanho da lista: ', len(df.index))
counter = 1
for counter in range(len(df.index)):
    if len(str(df.iloc[counter,12])) > 0:
        continue
    driver.get("https://saude.sulamericaseguros.com.br/prestador/servicos-medicos/contas-medicas/faturamento-tiss-3/faturamento/guia-de-sp-sadt/")
    carteirinha = df.iloc[counter,2]
    req = str(df.iloc[counter,3])
    data = str(df.iloc[counter,4])
    solicitante = df.iloc[counter,6]
    conselho = df.iloc[counter,7]
    uf_conselho = df.iloc[counter,8]
    n_conselho = str(df.iloc[counter,9])
    cbos = str(df.iloc[counter,10])
    indicacao = df.iloc[counter,11]
    procedimentos = df.iloc[counter,5].split(';')
    precos = []
    print('Aqui')
    for x in procedimentos:
        idx = ds[ds['CODIGO'] == int(x)].index[0]
        z  = ds.iloc[idx,7]
        precos.append(z)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'codigo-beneficiario-1'))).send_keys(carteirinha)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//button[contains(@class, "sas-form-submit")]'))).click()

    #WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'guia-sadt.profissional-solicitante.tipo-documento-operadora.codigo'))).send_keys('CNPJ')
    #WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'numero-profissional-operadora'))).send_keys('16867589000160')
    #WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'nome-contratado-solicitante'))).send_keys('Analise Medicina Laboratorial')
    #WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'solicitacao-sp-sadt.numero-guia-prestador'))).send_keys(req)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'nome-profissional-solicitante'))).send_keys(solicitante)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'conselho-profissional'))).send_keys(conselho)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'uf-conselho-profissional'))).send_keys(uf_conselho)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'numero-registro-conselho'))).send_keys(n_conselho)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'cbo'))).send_keys(cbos)
    #time.sleep(1)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@id="ui-id-1"]/li'))).click()
    
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'carater-atendimento'))).send_keys('E')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'data-solicitacao'))).send_keys(data)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'flag-atendimento-rn'))).send_keys('N')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'indicacao-clinica'))).send_keys(indicacao)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'tipo-atendimento'))).send_keys('E')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'indicador-acidente'))).send_keys('N')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'tipo-consulta'))).send_keys('Primeira')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'regime-atendimento'))).send_keys('Ambulatorial')

    #procedimentos = ['40302040','40301630','40302580','40301150','40302750','40316521','40316491','40302512','40302504','40302113','40302733']
    index = 0
    for proc in procedimentos:
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'per.data'))).send_keys(data)
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'per.codigo-procedimento'))).send_keys(proc)
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//a[contains(@class,"btn-busca-procedimento")]'))).click()
        if proc == '40303110':
            WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'per.quantidade'))).send_keys('3')
        else:
            WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'per.quantidade'))).send_keys('1')
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'per.valor-unitario'))).send_keys(str(precos[index]))
        WebDriverWait(driver, 8).until(EC.element_to_be_clickable((By.ID,'incluirPer'))).click()
        index += 1

    time.sleep(0.5)
    element = driver.find_element(By.XPATH,'//*[@id="tabelaPer"]/tbody/tr[15]')
    driver.execute_script('arguments[0].scrollIntoView(true);', element)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'confirmar-inclusao-sadt'))).click()
    time.sleep(1)
    try:
        erro = WebDriverWait(driver, 20).until(EC.element_to_be_clickable((By.CLASS_NAME,'msg-erro'))).text
        worksheet.update_cell(counter+2,19,erro)
    except:
        pass
    WebDriverWait(driver, 20).until(EC.element_to_be_clickable((By.ID,'btnDialogVoltarEditar'))).click()
    time.sleep(1)

    driver.get("https://saude.sulamericaseguros.com.br/prestador/segurado/validacao-de-procedimentos-tiss-3/validacao-de-procedimentos/consulta/")
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'codigo-beneficiario-1'))).send_keys(carteirinha)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'btn-pesquisar-solicitacao'))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@id="tab-lista-consulta"]/tbody/tr/td[1]'))).click()
    nGuia = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CLASS_NAME,'bt'))).text
    nGuiaPrestadora = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@name="ancora"]/div[1]/div[4]/div[2]/div[1]/span'))).text
    print(carteirinha,' - Guia ',nGuiaPrestadora,', cadastrada!')
    senhaAutorizacao = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@name="ancora"]/div[1]/div[4]/div[3]/div[1]/span'))).text
    dtAutorizacao = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@name="ancora"]/div[1]/div[4]/div[3]/div[2]/span'))).text
    dtValidade = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@name="ancora"]/div[1]/div[4]/div[3]/div[3]/span'))).text
    resultado = [nGuiaPrestadora,nGuia,senhaAutorizacao,dtAutorizacao.replace('/',''),dtValidade.replace('/','')]
    worksheet.update(f"M{counter+2}:Q{counter+2}",[resultado])

    driver.get("https://saude.sulamericaseguros.com.br/prestador/servicos-medicos/contas-medicas/faturamento-tiss-3/faturamento/validar-procedimento-autorizado/")
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'tipo-pesquisa-codigo-beneficiario'))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'codigo-beneficiario-1'))).send_keys(carteirinha)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'btn-pesquisar-procedimentos'))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@id="tab-lista-procedimentos"]/tbody/tr/td'))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'selectTipoGuia'))).send_keys('SADT')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'btn-confirmar-pesquisa'))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'data-autorizacao'))).send_keys(dtAutorizacao)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'data-validade-senha'))).send_keys(dtValidade)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'nome-profissional-solicitante'))).send_keys(solicitante)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'conselho-profissional'))).send_keys(conselho)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'uf-conselho-profissional'))).send_keys(uf_conselho)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'numero-registro-conselho'))).send_keys(n_conselho)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'cbo'))).send_keys(cbos)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@id="ui-id-1"]/li'))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'carater-atendimento'))).send_keys('E')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'data-solicitacao'))).send_keys(data)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'flag-atendimento-rn'))).send_keys('N')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'indicacao-clinica'))).send_keys(indicacao)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'tipo-atendimento'))).send_keys('E')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'indicador-acidente'))).send_keys('N')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'tipo-consulta'))).send_keys('Primeira')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'regime-atendimento'))).send_keys('Ambulatorial')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CLASS_NAME,'editarProcedRealiza'))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'per.data'))).send_keys(data)
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME,'per.valor-unitario'))).send_keys('3043')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'incluirPer'))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,'confirmar-inclusao-sadt'))).click()

    msgfinal = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'//*[@class="msg-erro"]/b'))).text
    worksheet.update_cell(counter+2,18,msgfinal)
    print(carteirinha,' - VPP ',msgfinal,' cadastrada!')


driver.execute_script("alert('ROTINA FINALIZADA');")