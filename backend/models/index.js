const { Sequelize } = require('sequelize');
const config = require('../config/config.json');
const env = process.env.NODE_ENV || 'development'; 
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
});

const db = {};

// Configurar Sequelize
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Importar modelos e adicionar ao objeto db
db.User = require('./users')(sequelize, Sequelize.DataTypes);
db.Category = require('./category')(sequelize, Sequelize.DataTypes);
db.Product = require('./product')(sequelize, Sequelize.DataTypes);
db.Client = require('./client')(sequelize, Sequelize.DataTypes);
db.Order = require('./order')(sequelize, Sequelize.DataTypes);
db.OrderItem = require('./orderItem')(sequelize, Sequelize.DataTypes);



// Um pedido tem muitos itens
db.Order.hasMany(db.OrderItem, { foreignKey: 'orderId' });
db.OrderItem.belongsTo(db.Order, { foreignKey: 'orderId' });

// Cada item tem um produto
db.Product.hasMany(db.OrderItem, { foreignKey: 'productId' });
db.OrderItem.belongsTo(db.Product, { foreignKey: 'productId' });




// Definir Relacionamentos
db.Category.hasMany(db.Product, { foreignKey: 'categoryId' });
db.Product.belongsTo(db.Category, { foreignKey: 'categoryId' });


module.exports = db;
