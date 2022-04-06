const express = require('express');
const path = require('path');
const axios = require('axios').default;
const morgan = require('morgan');
const NodeCache = require('node-cache');
const dateFns = require('date-fns');

const appCache = new NodeCache();

const app = express();

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message) => console.log(message.trim()),
    },
  }
);

app.use(morganMiddleware);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

async function getExchangeRates() {
  const response = await axios.get(
    'https://api.coingecko.com/api/v3/exchange_rates',
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  return response.data;
}

async function refreshExchangeRates() {
  const rates = await getExchangeRates();
  const result = {
    timestamp: Date.now(),
    rates,
  };

  appCache.set('exchangeRates', result, 600);

  console.log('Exchange rates cache updated');
  return result;
}

appCache.on('expired', async (key) => {
  try {
    if (key === 'exchangeRates') {
      await refreshExchangeRates();
    }
  } catch (err) {
    console.error(err);
  }
});

app.get('/', async (req, res, next) => {
  try {
    let data = appCache.get('exchangeRates');

    if (data == null) {
      data = await refreshExchangeRates();
    }

    res.render('home', {
      title: 'Bitcoin Exchange Rates',
      lastUpdated: dateFns.format(data.timestamp, 'LLL dd, yyyy hh:mm:ss a O'),
      data,
    });
  } catch (err) {
    console.error(err);
    res.set('Content-Type', 'text/html');
    res.status(500).send('<h1>Internal Server Error</h1>');
  }
});

const port = process.env.PORT || 3000;
const server = app.listen(port, async () => {
  console.log(`server started on port: ${port}`);

  try {
    await refreshExchangeRates();
  } catch (err) {
    console.error('Unable to refresh exchange rate due to error: ', err);
  }
});
