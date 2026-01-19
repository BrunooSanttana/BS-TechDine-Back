const express = require('express');
const router = express.Router();
const { Order, Product, OrderItem, sequelize } = require('../models'); // ajuste se necessário

router.post('/', async (req, res) => {
  const { tableNumber, paymentMethod, items } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'Nenhum item enviado no pedido' });
  }

  // Inicia transação
  const t = await sequelize.transaction();

  try {
    // 1️⃣ Cria o pedido
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    const order = await Order.create({
      tableNumber,
      paymentMethod,
      totalAmount
    }, { transaction: t });

    // 2️⃣ Processa cada item
    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction: t });

      if (!product) {
        throw new Error(`Produto com ID ${item.productId} não encontrado`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Estoque insuficiente para ${product.name}`);
      }

      // Diminui estoque
      product.stock -= item.quantity;
      await product.save({ transaction: t });

      // Cria OrderItem
      await OrderItem.create({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        total: item.total
      }, { transaction: t });
    }

    // Commit da transação
    await t.commit();

    res.status(201).json({ message: 'Pedido criado com sucesso', order });

  } catch (error) {
    await t.rollback(); // desfaz tudo se der erro
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: error.message || 'Erro ao criar o pedido' });
  }
});

router.get('/', async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [
        {
          model: OrderItem,
          include: [Product],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

// Buscar uma comanda específica pelo ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          include: [Product],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ error: 'Comanda não encontrada' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar a comanda' });
  }
});




module.exports = router;
