const { Model, DataTypes } = require('sequelize');

const bcrypt = require("bcryptjs");

class Customers extends Model {
  static init(sequelize) {
    super.init({
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.VIRTUAL,
      password_hash: DataTypes.STRING,
      address: DataTypes.STRING,
      district: DataTypes.STRING,
      address_number: DataTypes.STRING,
    },{
      sequelize
    });

    this.addHook('beforeSave', async customer => {
      if (customer.password) {
        customer.password_hash = await bcrypt.hash(customer.password, 8);
      }
    });

    return this;
  }

  checkPassword(password) {
    return bcrypt.compareSync(password, this.password_hash)  
  }

  static associate(models) {
    this.hasMany(models.Order, {
      foreignKey: 'customer_id',
    });
  }
}

module.exports = Customers;