# ANPD-

Ajustes no Painel TCU feitos a partir do Painel ANPD, e relatórios sobre o banco de questões.

`saida/Painel TCU.html` é o painel pronto para abrir no navegador.

## Refazer depois de um novo build

Se o `build.mjs` gerar o Painel TCU de novo, rode os scripts nesta ordem sobre o HTML gerado. Cada um altera o arquivo
no lugar e roda uma vez só (os de porte param sem gravar se o código ao redor tiver mudado):

```sh
python3 scripts/comprimir_dados.py "Painel TCU.html" "saida/Painel TCU.html"   # #dados em gzip+base64
python3 scripts/portar_do_anpd.py "saida/Painel TCU.html"                       # Voltar, foco, folha de véspera, metas
python3 scripts/corrigir_tcu.py "saida/Painel TCU.html"                         # quarentena do Gran, cofre, textos
python3 scripts/portar_do_anpd_v2.py "saida/Painel TCU.html"                    # recursos do ANPD de 24/10/2026
python3 scripts/copiar_pegadinhas_do_anpd.py "Painel ANPD.html" "saida/Painel TCU.html"
python3 scripts/quarentena_por_item.py "saida/Painel TCU.html"                  # item do Gran volta ao ser conferido
python3 scripts/aplicar_gabaritos.py relatorios/gabaritos-conferidos.csv "saida/Painel TCU.html"   # se já houver conferidos
```

## Devolver ao banco os itens do Gran

Preencha a coluna `gabarito_oficial` de `relatorios/gran-quarentena-por-prova.csv` com o gabarito definitivo da banca
(C/E, a letra, ou ANULADA), prova por prova, e rode:

```sh
python3 scripts/aplicar_gabaritos.py relatorios/gran-quarentena-por-prova.csv "saida/Painel TCU.html"
python3 scripts/lista_gran_por_prova.py "saida/Painel TCU.html" relatorios   # a planilha passa a listar só o que falta
```

Cada aplicação fica registrada em `relatorios/gabaritos-conferidos.csv`: é ele que devolve os itens depois de um
build novo. O resumo `relatorios/gran-quarentena-por-prova.md` explica o formato e o que acontece com o progresso já
registrado nesses itens.

## Relatórios

- `relatorios/itens-sem-explicacao.{md,csv}`: itens cujo comentário só repete o gabarito, na ordem de trabalho.
- `relatorios/gran-quarentena-por-prova.{md,csv}`: os itens do Gran em quarentena, por prova de origem, com a coluna
  `gabarito_oficial` para preencher.
