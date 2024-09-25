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

  try {
    const response = await fetch('https://masterzoo.ua/ua/api/auth/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ login, password })
    });

    const data = await response.json();
    console.log('Response from auth API:', data); // Логування відповіді
    if (data.status === 'OK') {
      return data.response.token; // Повертаємо токен
    } else {
      throw new Error(data.response.message || 'Невірний логін або пароль');
    }
  } catch (error) {
    console.error('Помилка аутентифікації:', error.message);
    throw error;
  }
}

// Endpoint для отримання даних про товар за артикулом
app.post('/api/product/export', async (req, res) => {
  const { numberOrder } = req.body; // Отримуємо артикул з тіла запиту
  console.log('Отримано номер замовлення:', numberOrder);

  try {
    const token = await authenticate(); // Отримуємо токен
    console.log('Токен:', token); // Логування токена

    const payload = {
      expr: { article: ["11399", "1111168094"] }, // Передача артикула
      limit: 2, // Кількість товарів
      token: token // Токен авторизації
    };

    // Запит на експорт товарів
    const fetch = (await import('node-fetch')).default; // Динамічний імпорт
    const response = await fetch('https://masterzoo.ua/api/catalog/export/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload) // Передача даних
    });

    const data = await response.json();
    console.log('Response from catalog API:', data); // Логування відповіді

    if (data.status === 'OK') {
      const productsInfo = data.response.products.map(product => ({
        article: product.article,
        discount: product.discount,
        discount: product.price,
        discount: product.price_old
      }));

      console.log('Інформація про продукти:', productsInfo);

      // Формування замовлення для оновлення
     
   

      const items = [
        {
          initialPrice: 27.2, // Нова ціна
          quantity: 1,
          offer: {
            externalId: 11399 // Ідентифікатор товару
          }
        }
      ];
      console.log('Items to be sent:', items);

      const params = {
        site: 'testovyi-magazin',
        order:JSON.stringify(items) // Передаємо оновлені товари
        
      };

   

      const updateUrl = `https://masterzoo.simla.com/api/v5/orders/2987321/edit?by=id&apiKey=jazPM3ufgIzByAktZDi0lTtT9KPSJHHz`;

      try {
        const postResponse = await axios.post(updateUrl, qs.stringify(params), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        console.log('Response from order update API:', postResponse.data);
        res.status(200).json(postResponse.data); // Відправляємо відповідь від API
      } catch (error) {
        console.error('Помилка в POST-запиті:', error.response ? error.response.data : error.message);
        res.status(500).json({
          status: 'ERROR',
          message: 'Помилка під час оновлення замовлення: ' + (error.response ? error.response.data : error.message)
        });
      }
    } else {
      res.status(500).json({
        status: 'ERROR',
        message: 'Помилка при отриманні товарів: ' + data.response.message
      });
    }
  } catch (error) {
    console.error('Помилка в загальному обробленні:', error.message);
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

