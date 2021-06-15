const Customer = require('../../models/Customer');
const Restaurant = require('../../models/Restaurant');

module.exports = {
  async index(req, res) {

    const restaurants = await Restaurant.findAll({
      attributes: [
          "id",
          "restaurant_name",
          "banner_path",
          "digital_address"
        ]
    });
    console.log(restaurants);
  
    return res.json({ restaurants });
  }
}