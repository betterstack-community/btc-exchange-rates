const express = require('express');
const path = require('path');
const axios = require('axios');
const morgan = require('morgan');
const NodeCache = require('node-cache');

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

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'pug');

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
  appCache.set('exchangeRates', rates, 600);
  console.log('Exchange rates cache updated');
  return rates;
}

refreshExchangeRates();

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
    let rates = appCache.get('exchangeRates');

    if (rates == null) {
      rates = await refreshExchangeRates();
    }

    res.render('home', {
      title: 'Bitcoin Exchange Rates',
      rates,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/joke', async (req, res, next) => {
  try {
    const response = await getRandomJoke();
    res.json(response);
  } catch (err) {
    next(err);
  }
});

app.use(function (err, req, res, next) {
  console.error(err);
  res.set('Content-Type', 'text/html');
  res.status(500).send('<h1>Internal Server Error</h1>');
});

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`server started on port: ${server.address().port}`);
});
