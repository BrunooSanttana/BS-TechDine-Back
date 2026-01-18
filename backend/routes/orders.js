const express = require('express');
const router = express.Router();
const { Order, Product, OrderItem } = require('../models'); // adicione OrderItem se tiver
const { Op } = require('sequelize');

// Endpoint para criar um pedido
router.post('/', async (req, res) => {
  const { tableNumber, paymentMethod, items } = req.body;

  try {
    // 1️⃣ Criar o pedido
    const order = await Order.create({
      tableNumber,
      paymentMethod,
      totalAmount: items.reduce((sum, item) => sum + item.total, 0),
    });

    // 2️⃣ Para cada item, criar OrderItem e diminuir estoque
    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      if (!product) return res.status(404).json({ error: `Produto ${item.productId} não encontrado` });

      // verifica estoque
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Estoque insuficiente para ${product.name}` });
      }

      // diminui estoque
      product.stock -= item.quantity;
      await product.save();

      // cria o registro do item no pedido (opcional se você tiver OrderItem)
      await OrderItem.create({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        total: item.total
      });
    }

    res.status(201).json({ message: 'Pedido criado e estoque atualizado', order });

  } catch (error) {
    console.error('Erro ao criar o pedido:', error);
    res.status(500).json({ error: 'Erro ao criar o pedido' });
  }
});

module.exports = router;
