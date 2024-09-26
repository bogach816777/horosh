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

  // Максимальна тривалість виконання (в мілісекундах)
  const maxDuration = 20000; // 5 секунд

  // Функція, що виконує ваш основний код
  const executeMainLogic = async () => {
    const response = await axios.get(apiUrl);
    const items = response.data.orders[0].items;

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
      
      const totalPrice = productsInfo.reduce((total, product) => {
        // Знаходимо відповідний item за article
        const item = items.find(i => i.offer.externalId === product.article);
        if (item) {
          const priceWithDiscount = product.price * (1 - product.discount / 100); // Ціна зі знижкою
          const totalItemPrice = priceWithDiscount * item.quantity; // Загальна ціна за кількість
          return total + totalItemPrice; // Додаємо до загальної суми
        }
        return total; // Якщо товар не знайдено, просто повертаємо поточну загальну суму
      }, 0);
      
      const formattedTotalPrice = totalPrice.toFixed(2); // Форматуємо до двох знаків після коми
      
      console.log(`Загальна ціна: ${formattedTotalPrice}`);
      const Paymentssall = response.data.orders[0].payments;
      const paymentKeys = Object.keys(Paymentssall); // Отримаєте масив ключів
      const firstPaymentId = Paymentssall[paymentKeys[0]].id; // Витягуєте id першого платежу
      console.log(firstPaymentId);
      const orderData = {
        items: formattedProducts
      };
      const orderData2 = {

        "amount": formattedTotalPrice,
        "status": "not-paid"
      
    
      };
      const params = {
        site: 'testovyi-magazin',
        order: JSON.stringify(orderData), // Передаємо оновлені items
      };
      const params2 = {
        site: 'testovyi-magazin',
        payment:JSON.stringify(orderData2) // Передаємо оновлені товари
        
      };
      const updateUrl = `https://masterzoo.simla.com/api/v5/orders/${numberId}/edit?by=id&apiKey=jazPM3ufgIzByAktZDi0lTtT9KPSJHHz`;
      const updateUrl2 = `https://masterzoo.simla.com/api/v5/orders/payments/${firstPaymentId}/edit?by=id&apiKey=jazPM3ufgIzByAktZDi0lTtT9KPSJHHz`;
      console.log('Items to be sent:', items);

      async function postUpdate(url, params) {
        try {
          const postResponse = await axios.post(url, qs.stringify(params), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          return postResponse.data;
        } catch (error) {
          console.error('Помилка в POST-запиті:', error.response ? error.response.data : error.message);
          throw new Error('Помилка під час оновлення замовлення.');
        }
      }
      
      const postResult1 = await postUpdate(updateUrl, params);
      const postResult2 = await postUpdate(updateUrl2, params2);
      const result = {
        orderUpdate: postResult1,
        paymentUpdate: postResult2
      };
      
      res.status(200).json(result);
      
    } else {
      throw new Error('Помилка при отриманні товарів: ' + data.response.message);
    }
  };

  // Запускаємо основну логіку з контролем тривалості
  try {
    const result = await Promise.race([
      executeMainLogic(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Перевищено максимальний час виконання')), maxDuration))
    ]);

    res.status(200).send(result);
  } catch (error) {
    console.error('Помилка:', error.message);
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
