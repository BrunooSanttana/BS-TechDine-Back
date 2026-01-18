const express = require('express');
const router = express.Router();
const { Product } = require('../models');

// 🔹 Listar estoque
router.get('/', async (req, res) => {
  try {
    const products = await Product.findAll({
      attributes: ['id', 'name', 'stock'],
      order: [['name', 'ASC']]
    });

    res.json(products);
  } catch (err) {
    console.error('Erro ao buscar estoque:', err);
    res.status(500).json({ error: 'Erro ao buscar estoque' });
  }
});

// 🔹 Atualizar estoque manualmente
router.put('/:id', async (req, res) => {
  try {
    const { stock } = req.body;
    const { id } = req.params;

    // ✅ validação
    if (stock === undefined || typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({ error: 'Valor de estoque inválido' });
    }

    // ✅ verifica se produto existe
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // ✅ atualiza
    product.stock = stock;
    await product.save();

    res.json({
      message: 'Estoque atualizado com sucesso',
      product: {
        id: product.id,
        name: product.name,
        stock: product.stock
      }
    });

  } catch (err) {
    console.error('Erro ao atualizar estoque:', err);
    res.status(500).json({ error: 'Erro ao atualizar estoque' });
  }
});

// 🔻 Baixar estoque (ex: venda)
router.post('/decrease/:id', async (req, res) => {
  try {
    const { quantity } = req.body;
    const { id } = req.params;

    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'Quantidade inválida' });
    }

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Estoque insuficiente' });
    }

    product.stock -= quantity;
    await product.save();

    res.json({
      message: 'Estoque atualizado após venda',
      stock: product.stock
    });

  } catch (err) {
    console.error('Erro ao baixar estoque:', err);
    res.status(500).json({ error: 'Erro ao baixar estoque' });
  }
});


module.exports = router;
