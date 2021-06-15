const { Model, DataTypes } = require('sequelize');

const bcrypt = require("bcryptjs");

class Deliveryman extends Model {
  static init(sequelize) {
    super.init({
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.VIRTUAL,
      password_hash: DataTypes.STRING,
      transport: DataTypes.STRING,
    },{
      sequelize
    });

    this.addHook('beforeSave', async deliveryman => {
      if (deliveryman.password) {
        deliveryman.password_hash = await bcrypt.hash(deliveryman.password, 8);
      }
    });
    
    return this;
  }

  checkPassword(password) {
    return bcrypt.compareSync(password, this.password_hash)  
  }


}

module.exports = Deliveryman;