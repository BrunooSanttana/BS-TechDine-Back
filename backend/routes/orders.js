const express = require('express');
const router = express.Router();
const { Order, Product, OrderItem, sequelize } = require('../models');

// ---------------------
// GET /orders - listar todas as comandas
// ---------------------
router.get('/', async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [{ model: OrderItem, include: [Product] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

// ---------------------
// GET /orders/:id - buscar uma comanda específica
// ---------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, include: [Product] }],
    });
    if (!order) return res.status(404).json({ error: 'Comanda não encontrada' });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar a comanda' });
  }
});

// ---------------------
// POST /orders - criar nova comanda
// ---------------------
router.post('/', async (req, res) => {
  const { tableNumber, paymentMethod, items } = req.body;

  if (!tableNumber || !items || !items.length) {
    return res.status(400).json({ error: 'Mesa/Cliente e itens são obrigatórios' });
  }

  const t = await sequelize.transaction();

  try {
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

    const order = await Order.create({ tableNumber, paymentMethod, totalAmount }, { transaction: t });

    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction: t });
      if (!product) throw new Error(`Produto com ID ${item.productId} não encontrado`);
      if (product.stock < item.quantity) throw new Error(`Estoque insuficiente para ${product.name}`);

      product.stock -= item.quantity;
      await product.save({ transaction: t });

      await OrderItem.create(
        { orderId: order.id, productId: item.productId, quantity: item.quantity, total: item.total, note: item.note || '' },
        { transaction: t }
      );
    }

    await t.commit();
    res.status(201).json({ message: 'Pedido criado com sucesso', order });
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro ao criar o pedido' });
  }
});

// ---------------------
// POST /orders/:orderId/items - adicionar item a comanda existente
// ---------------------
router.post('/:orderId/items', async (req, res) => {
  const { orderId } = req.params;
  const { productId, quantity, total, note } = req.body;

  if (!productId || !quantity || !total) {
    return res.status(400).json({ error: 'Produto, quantidade e total são obrigatórios' });
  }

  const t = await sequelize.transaction();

  try {
    const order = await Order.findByPk(orderId, { transaction: t, include: [OrderItem] });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: 'Comanda não encontrada' });
    }

    const product = await Product.findByPk(productId, { transaction: t });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    if (product.stock < quantity) {
      await t.rollback();
      return res.status(400).json({ error: `Estoque insuficiente para ${product.name}` });
    }

    let orderItem = await OrderItem.findOne({ where: { orderId, productId }, transaction: t });

    if (orderItem) {
      // incrementa
      orderItem.quantity += quantity;
      orderItem.total += total;
      if (note) orderItem.note = note; // opcionalmente atualiza a nota
      await orderItem.save({ transaction: t });
    } else {
      // cria novo item
      orderItem = await OrderItem.create(
        { orderId, productId, quantity, total, note: note || '' },
        { transaction: t }
      );
    }

    product.stock -= quantity;
    await product.save({ transaction: t });

    order.totalAmount += total;
    await order.save({ transaction: t });

    await t.commit();
    res.json({ message: 'Item adicionado à comanda', orderItem, totalAmount: order.totalAmount });
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar item à comanda' });
  }
});

// ---------------------
// DELETE /orders/:orderId/items/:itemId - remover item
// ---------------------
router.delete('/:orderId/items/:itemId', async (req, res) => {
  const { orderId, itemId } = req.params;
  const t = await sequelize.transaction();

  try {
    const orderItem = await OrderItem.findOne({ where: { id: itemId, orderId }, transaction: t });
    if (!orderItem) {
      await t.rollback();
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    const product = await Product.findByPk(orderItem.productId, { transaction: t });
    if (product) {
      product.stock += orderItem.quantity;
      await product.save({ transaction: t });
    }

    await orderItem.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Item removido com sucesso' });
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover item' });
  }
});

// ---------------------
// PATCH /orders/:orderId/items/:itemId/decrement - decrementar item
// ---------------------
router.patch('/:orderId/items/:itemId/decrement', async (req, res) => {
  const { orderId, itemId } = req.params;

  try {
    const orderItem = await OrderItem.findOne({ where: { id: itemId, orderId }, include: [Product] });
    if (!orderItem) return res.status(404).json({ error: 'Item não encontrado na comanda' });

    if (orderItem.quantity > 1) {
      orderItem.quantity -= 1;
      orderItem.total -= orderItem.Product.price;
      await orderItem.save();

      const product = await Product.findByPk(orderItem.productId);
      if (product) {
        product.stock += 1;
        await product.save();
      }

      res.json({ message: 'Quantidade decrementada', orderItem });
    } else {
      const product = await Product.findByPk(orderItem.productId);
      if (product) {
        product.stock += 1;
        await product.save();
      }
      await orderItem.destroy();
      res.json({ message: 'Item removido', removedItemId: itemId });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao decrementar item' });
  }
});

module.exports = router;
