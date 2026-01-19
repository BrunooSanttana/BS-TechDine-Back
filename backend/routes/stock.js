const express = require('express');
const router = express.Router();
const { Product } = require('../models');

router.get('/', async (req, res) => {
  console.log('QUERY RECEBIDA:', req.query);

  try {
    const { categoryId } = req.query;

    const where = {};
    if (categoryId) {
      where.categoryId = Number(categoryId);
    }

    const products = await Product.findAll({
      where,
      attributes: ['id', 'name', 'stock', 'categoryId'],
      order: [['name', 'ASC']]
    });

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar estoque' });
  }
}); // ✅ FECHOU O router.get AQUI

router.put('/:id', async (req, res) => {
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

module.exports = router;
