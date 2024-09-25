

const express = require('express');
const axios = require('axios');
const qs = require('qs');
const app = express();

// Middleware для парсингу JSON у запитах
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Функція для аутентифікації
async function authenticate() {
  const fetch = (await import('node-fetch')).default; // Динамічний імпорт
  const login = "masterzoo.ua";
  const password = "menAPIzOo300";

  const response = await fetch('https://masterzoo.ua/ua/api/auth/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ login, password })
  });

  const data = await response.json();
  if (data.status === 'OK') {
    return data.response.token; // Повертаємо токен
  } else {
    throw new Error(data.response.message || 'Невірний логін або пароль');
  }
}

// Endpoint для отримання даних про товар за артикулом
app.post('/api/product/export', async (req, res) => {
  const { numberOrder, numberId } = req.body; // Отримуємо артикул з тіла запиту
  console.log(numberOrder);
  const apiUrl = `https://masterzoo.simla.com/api/v5/orders?&apiKey=opTAMNtCF3sE795yTNoHIyc5MRg2flRu&filter[numbers][]=${numberOrder}`;
  
  try {
    const response = await axios.get(apiUrl);
    const items = response.data.orders[0].items;
    
    // Отримуємо externalId для кожного елемента
    const externalIds = items.map(item => item.offer.externalId);
    console.log(externalIds);
    
    const token = await authenticate(); // Отримуємо токен
    console.log('Токен:', token); // Логування токена

    const payload = {
      expr: { article: externalIds },
      limit: externalIds.length,
      token: token
    };

    // Запит на експорт товарів
    const fetch = (await import('node-fetch')).default; // Динамічний імпорт
    const productResponse = await fetch('https://masterzoo.ua/api/catalog/export/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await productResponse.json();
    console.log('Response from API:', data);

    if (data.status === 'OK') {
      // Збираємо інформацію про всі продукти
      const productsInfo = data.response.products.map(product => ({
        article: product.article,
        discount: product.discount,
        price: product.price,
        price_old: product.price_old
      }));
      console.log(productsInfo);

      const formattedProducts = productsInfo.map(product => {
        let discountManualPercent = 0;
      
        // Перевірка, чи є знижка
        if (product.discount > 0) {
          discountManualPercent = product.discount; // Використовуємо знижку, якщо вона більше 0
        } else if (product.price_old > 0) {
          // Обчислюємо відсоток знижки, якщо discount 0
          discountManualPercent = Math.round(((product.price_old - product.price) / product.price_old) * 100);
        }
      
        return {
          offer: {
            externalId: product.article,
            article: product.article
          },
          discountManualPercent: discountManualPercent
        };
      });
      
      console.log(formattedProducts);
      const orderData = {
        items:formattedProducts
    };
      const params = {
        site: 'testovyi-magazin',
        order: JSON.stringify(orderData), // Передаємо оновлені items
      };

      const updateUrl = `https://masterzoo.simla.com/api/v5/orders/${numberId}/edit?by=id&apiKey=jazPM3ufgIzByAktZDi0lTtT9KPSJHHz`;
console.log('Items to be sent:', items);


      try {
        const postResponse = await axios.post(updateUrl, qs.stringify(params), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        res.status(200).send(postResponse.data); // Відправляємо відповідь від API
      } catch (error) {
      console.error('Помилка в POST-запиті:', error.response ? error.response.data : error.message);
        res.status(500).send('Помилка під час оновлення замовлення. ', error.response ? error.response.data : error.message);
      }
    } else {
      res.status(500).json({
        status: 'ERROR',
        message: 'Помилка при отриманні товарів: ' + error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    // Обробка помилок
    res.status(500).json({
      status: 'ERROR',
      message: 'Помилка сервера або підключення: ' + error.message
    });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
