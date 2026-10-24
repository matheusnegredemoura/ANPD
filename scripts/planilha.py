# Leitura da planilha dos itens em quarentena, comum a lista_gran_por_prova.py e aplicar_gabaritos.py
import csv
import io


def ler_planilha(caminho):
    """CSV do script ou salvo pelo Excel em português (separador ';' e codificação do Windows)."""
    bruto = open(caminho, 'rb').read()
    try:
        texto = bruto.decode('utf-8-sig')
    except UnicodeDecodeError:
        texto = bruto.decode('cp1252')
    cab = texto.split('\n', 1)[0]
    return list(csv.DictReader(io.StringIO(texto), delimiter=';' if cab.count(';') > cab.count(',') else ','))
