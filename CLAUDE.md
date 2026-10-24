# Painel ANPD: regras do projeto

- Até sair o edital, nenhuma mecânica de jogo nova (modo, minijogo, moeda, ranking, conquista de volume). Entra conteúdo e ajuste guiado pelos dados de uso. Detalhes no README, seção "Regra até o edital".
- Código do app em `src/js/` (um arquivo por parte; o build junta na ordem do nome, num único escopo). Estilos em `src/app.css`, casca em `src/app.html`.
- Antes de commitar: `npm run validar`, `npm test` (inclui a auditoria de números dos itens) e `npm run build`. Testes de navegador: `npm run test:navegador` (em paralelo); teste novo ou mexido roda antes com `-- nome --repetir 3`.
- Item novo segue `docs/padrao-cebraspe.md` (mecanismos de construção, paráfrase em vez de cópia, um único erro por item errado) e cita a norma (`ref`) e um `trecho` literal que existe no artigo; item real tem `origem: real` e `prova`. Comentários são próprios; de material de curso, só trechos curtos com crédito.
- Nunca copiar para o repositório linhas de licença ou de identificação de e-books de cursinho, nem dados pessoais de quem usa o painel.
