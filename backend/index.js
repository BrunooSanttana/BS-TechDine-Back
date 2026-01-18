const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { User, Product, Order } = require('./models'); // Certifique-se de que Product está importado
const categoryRoutes = require('./routes/categories'); 
const productRoutes = require('./routes/product');
const clientsRoutes = require ('./routes/clients');
const totalSalesRoutes = require('./routes/totalSales'); 
const orderRoutes = require('./routes/orders');
const stockRoutes = require('./routes/stock');
const { Op } = require('sequelize'); // Importando Op


const app = express();

app.use(cors()); // Use o CORS globalmente
app.use(express.json());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // Adicione 'unsafe-eval' conforme necessário
      // Adicione outras diretivas conforme necessário
    }
  }
}));

// Rota de login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Usuário não encontrado' });
    }

    // Verificação de senha (ajuste conforme necessário)
    const isPasswordValid = password === user.password;

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Usuário ou Senha incorreta' });
    }

    return res.status(200).json({ message: 'Login confirmado com sucesso', user });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Rota de registro
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Verifique se o email já existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Criação do novo usuário
    const user = await User.create({
      username,
      email,
      password,
    });

    return res.status(201).json(user);
  } catch (error) {
    console.error('Erro ao criar um usuário:', error);
    return res.status(500).json({ error: 'Erro ao criar um usuário' });
  }
});

app.post('/products', async (req, res) => {
  const { name, price, categoryId } = req.body;
  console.log('Dados recebidos:', req.body); // Adicione isso


  if (!name || !price || !categoryId) {
    return res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios' });
  }

  // Verifique se o categoryId é um número
  if (isNaN(categoryId)) {
    return res.status(400).json({ error: 'Categoria inválida' });
  }

  try {
    const product = await Product.create({
      name,
      price: parseFloat(price),
      categoryId: parseInt(categoryId, 10),
    });

    return res.status(201).json(product);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

// Rota para buscar faturamento
app.get('/faturamento', async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const orders = await Order.findAll({
      where: {
        createdAt: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      attributes: ['totalAmount'],
    });
    
    const total = orders.reduce((sum, order) => sum + parseFloat(order.dataValues.totalAmount), 0);
    res.json({ total, orders });
    
  } catch (error) {
    console.error('Erro ao buscar faturamento:', error);
    res.status(500).json({ error: 'Erro ao buscar faturamento' });
  }
});

// ================= ESTOQUE =================

// Listar estoque
app.get('/stock', async (req, res) => {
  try {
    const products = await Product.findAll({
      attributes: ['id', 'name', 'stock']
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar estoque' });
  }
});

// Atualizar estoque manualmente
app.put('/stock/:id', async (req, res) => {
  try {
    const { stock } = req.body;

    await Product.update(
      { stock },
      { where: { id: req.params.id } }
    );

    res.json({ message: 'Estoque atualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar estoque' });
  }
});



// Adicione as novas rotas aqui
app.use('/categories', categoryRoutes);
app.use('/products', productRoutes);
app.use('/clients', clientsRoutes);
app.use('/totalSales', totalSalesRoutes);
app.use('/orders', orderRoutes);
app.use('/stock', stockRoutes)



app.listen(5000, () => {
  console.log('Servidor rodando na porta 5000');
});
