# Fortalfy v18 — revisão de interface

## Melhorias
- Painel inicial reorganizado com hierarquia visual, faixa de boas-vindas, atalhos consistentes e cartões responsivos.
- Navegação inferior e áreas principais receberam acabamento visual mais próximo de um aplicativo corporativo.
- Fortalfy Food ganhou layout de marketplace com cartões maiores, imagens, espaço para ofertas e descontos, categorias e busca.
- Clicar no cartão de um prato abre uma tela de detalhes com foto, descrição, preço, restaurante, previsão ilustrativa, informações e seletor de quantidade.
- Mantém os três sons e os módulos incluídos na versão v17.

## Validação e limites
- JavaScript extraído do HTML passou em `node --check`.
- Não foi realizado teste E2E em navegador real.
- Restaurantes, preços, promoções, avaliações, prazos e entrega continuam demonstrativos. Não há transmissão real de pedidos, cálculo de frete nem processamento de pagamento.
- Para ofertas comerciais reais, é necessário cadastrar parceiros, regras de desconto, validade, estoque e condições; a interface não deve inventar promoções reais.
