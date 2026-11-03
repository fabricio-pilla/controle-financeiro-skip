migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"
    const controlsColId = app.findCollectionByNameOrId('financial_controls').id

    try {
      app.findCollectionByNameOrId('data_backups')
    } catch (_) {
      const dataBackups = new Collection({
        name: 'data_backups',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'control_id',
            type: 'relation',
            required: true,
            collectionId: controlsColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          {
            name: 'backup_type',
            type: 'select',
            values: ['current', 'yearly'],
            required: true,
            maxSelect: 1,
          },
          { name: 'year', type: 'number', required: false },
          { name: 'size_bytes', type: 'number', required: false },
          { name: 'data_json', type: 'json', maxSize: 52428800, required: false }, // até 50MB
          { name: 'file', type: 'file', maxSize: 52428800, required: false }, // até 50MB
          { name: 'metadata', type: 'json', required: false },
          { name: 'created_by', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_data_backups_control ON data_backups (control_id)',
          'CREATE INDEX idx_data_backups_control_type ON data_backups (control_id, backup_type)',
          'CREATE INDEX idx_data_backups_control_year ON data_backups (control_id, year)',
        ],
      })
      app.save(dataBackups)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('data_backups')
      app.delete(col)
    } catch (_) {}
  },
)
