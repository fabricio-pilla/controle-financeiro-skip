/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'

    // Verificar se existem transações para o controle 'Casa'
    let maxTx = null
    try {
      const records = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}'`,
        '-amount',
        1,
        0,
      )
      if (records && records.length > 0) {
        maxTx = records[0]
      }
    } catch (_) {}

    // Idempotência: se não houver transações ou se o maior amount for < 100000,
    // assumir que já foi convertido para reais ou não precisa de conversão e pular
    if (!maxTx) {
      console.log('Nenhuma transação encontrada para o controle Casa. Pulando migração.')
      return
    }

    const maxAmount = maxTx.get('amount') || 0
    if (maxAmount < 100000) {
      console.log(
        `Maior valor encontrado (${maxAmount}) é menor que 100000. Valores já estão em reais. Pulando.`,
      )
      return
    }

    // Dividir por 100 todos os valores da tabela transactions do controle 'Casa'
    app
      .db()
      .newQuery(
        "UPDATE transactions SET amount = amount / 100 WHERE control_id = 'y9ewjfbhzoihnq0'",
      )
      .execute()

    console.log('Valores da tabela transactions do controle Casa divididos por 100 com sucesso.')
  },
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'

    // Rollback: multiplicar por 100 caso necessário
    app
      .db()
      .newQuery(
        "UPDATE transactions SET amount = amount * 100 WHERE control_id = 'y9ewjfbhzoihnq0'",
      )
      .execute()
  },
)
