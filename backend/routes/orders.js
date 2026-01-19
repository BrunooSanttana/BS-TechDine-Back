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

// DELETE /orders/:orderId/items/:itemId
router.delete('/:orderId/items/:itemId', async (req, res) => {
  const { orderId, itemId } = req.params;

  // Inicia transação para segurança
  const t = await sequelize.transaction();

  try {
    // Busca o OrderItem específico dentro do pedido
    const orderItem = await OrderItem.findOne({
      where: { id: itemId, orderId }, // garante que só esse item seja deletado
      transaction: t,
    });

    if (!orderItem) {
      await t.rollback();
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    // Restaura o estoque do produto
    const product = await Product.findByPk(orderItem.productId, { transaction: t });
    if (product) {
      product.stock += orderItem.quantity;
      await product.save({ transaction: t });
    }

    // Deleta apenas este item
    await orderItem.destroy({ transaction: t });

    await t.commit();
    res.json({ message: 'Item removido com sucesso' });
  } catch (error) {
    await t.rollback();
    console.error('Erro ao remover item:', error);
    res.status(500).json({ error: 'Erro ao remover item' });
  }
});

// PATCH /orders/:orderId/items/:itemId/decrement
router.patch('/:orderId/items/:itemId/decrement', async (req, res) => {
  const { orderId, itemId } = req.params;

  try {
    const orderItem = await OrderItem.findOne({
      where: { id: itemId, orderId: orderId },
      include: [Product]
    });

    if (!orderItem) {
      return res.status(404).json({ error: 'Item não encontrado na comanda' });
    }

    // Se tiver mais de 1 unidade, decrementa
    if (orderItem.quantity > 1) {
      orderItem.quantity -= 1;
      orderItem.total -= orderItem.Product.price; // ajusta o total
      await orderItem.save();

      // Repor estoque
      const product = await Product.findByPk(orderItem.productId);
      if (product) {
        product.stock += 1;
        await product.save();
      }

      res.json({ message: 'Quantidade decrementada', orderItem });
    } else {
      // Se for 1 unidade, remove o item
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
