const colors = require('colors');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');


dotenv.config({ path: './config/.env' });


const connectionString = process.env.NODE_ENV === 'production' ? process.env.DB : process.env.DEV_DB;
const client = new MongoClient(connectionString);

client.connect()
  .then(client => {
    module.exports = client;

    const app = require('./app');
    const PORT = process.env.PORT || 9999;

    const server = app.listen(PORT, () => {
      console.log(':>>'.green.bold, 'Server running in'.yellow.bold,  process.env.NODE_ENV.toUpperCase().blue.bold, 'mode, on port'.yellow.bold, `:${PORT}`.blue.bold);
    })

    // 'Handle' unhandled promise rejections
    process.on('unhandledRejection', error => {
      console.log(error);
      console.log(`✖ | Error: ${error?.message}`.red.bold);

      server.close(() => process.exit(1));
    })
  })
