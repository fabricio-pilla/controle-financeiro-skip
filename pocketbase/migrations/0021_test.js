migrate(
  (app) => {
    console.log('Migration 0021 executing...')
    try {
      const cdnRes = $http.send({
        url: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
        method: 'GET',
        timeout: 30,
      })
      console.log('CDN status:', cdnRes.statusCode)
    } catch (err) {
      console.log('Error in migration 0021:', err.message)
    }
  },
  (app) => {},
)
