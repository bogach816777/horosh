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
    const personalDiscount = response.data.orders[0].customer.personalDiscount;
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
      let issuePersonalDiscount =0;
      if(personalDiscount){
        console.log("Перс знижка", personalDiscount)
        if (personalDiscount == 0){
          issuePersonalDiscount = 5
        } else{
          issuePersonalDiscount = personalDiscount
        }
      }
      else{
        issuePersonalDiscount == 5
      }
      console.log("ПІсля перевірки Перс знижка", issuePersonalDiscount)
      const formattedProducts = productsInfo.map(product => {
        let discountManualPercent = 0;
        let initialPrice = product.price;
        // Перевірка, чи є знижка
        if (product.discount > 0) {
          discountManualPercent = product.discount; // Використовуємо знижку, якщо вона більше 0
          initialPrice = product.price
        } else if (product.discount == 0) {
          // Обчислюємо відсоток знижки, якщо discount 0
          discountManualPercent = Math.round(((product.price_old - product.price) / product.price_old) * 100);
          if (discountManualPercent < 0 ){
            discountManualPercent = issuePersonalDiscount;
            initialPrice = product.price
          }
          if (discountManualPercent > 0 ){
            initialPrice = product.price_old;
          }
          
        }
      //!!!!!!!!!!!!! якщо знижка на товар 0 додаємо знижку із перс. дісконту програми якщо дісконт 0 клієнта то підставити 5%
        return {
          initialPrice: initialPrice,
          offer: {
            externalId: product.article,
            article: product.article
          },
          discountManualPercent: discountManualPercent 
        };
      });
      
      console.log(formattedProducts)

      const orderData = {
        items: formattedProducts,
      };
      
      const params = {
        site: 'masterzoo-ua-ua',
        order: JSON.stringify(orderData), // Передаємо оновлені items
      };

      const updateUrl = `https://masterzoo.simla.com/api/v5/orders/${numberId}/edit?by=id&apiKey=jazPM3ufgIzByAktZDi0lTtT9KPSJHHz`;
      

      try {
        const postResponse = await axios.post(updateUrl, qs.stringify(params), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        return postResponse.data; // Повертаємо відповідь
      } catch (error) {
        console.error('Помилка в POST-запиті:', error.response ? error.response.data : error.message);
        throw new Error('Помилка під час оновлення замовлення.');
      }
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
