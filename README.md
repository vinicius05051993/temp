# Página de cobranças

Implementação em HTML, CSS e JavaScript puro, organizada para facilitar manutenção.

## Estrutura

- `index.html`: estrutura da página e modal Pix.
- `css/styles.css`: estilos, cores, responsividade e componentes visuais.
- `js/demo-data.js`: cobranças fictícias para testar a tela localmente.
- `js/app.js`: normalização dos dados, indicadores, filtros, tabela, paginação e ações.

## Executar localmente

Abra `index.html` no navegador. A página usa os dados de `js/demo-data.js`.

## Integrar ao Magento

No template `.phtml`, defina `window.COBRANCAS_JSON` **antes** de carregar `js/app.js`:

```php
<script>
    window.COBRANCAS_JSON = <?= /* @noEscape */ $block->getJsonData(
        $ltiCustomerTaxvat,
        $ltiCodeCli,
        $ltiToken
    ) ?>;
</script>
```

No Magento, remova a inclusão de `js/demo-data.js` ou mantenha-a como fallback; `window.COBRANCAS_JSON` tem prioridade quando definido.

## Campos opcionais

- `paymentType`: `pix` ou `boleto`, para identificar explicitamente a forma de pagamento.
- `pixCopyPaste`: código Pix copia-e-cola.
- `pix_qr_code`: URL da imagem do QR Code.
- `pixExpiresAt`: validade do código Pix.
- `paidAt`: data de pagamento da cobrança quitada.

O JSON atual do bloco fornece `pix_qr_code` para Pix, mas não fornece a data de pagamento nem a validade do Pix. Esses campos só serão exibidos com valores reais quando forem enviados pela integração.
