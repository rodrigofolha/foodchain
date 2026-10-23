const Deliveryman = require('../../models/Deliveryman');
const Restaurant = require('../../models/Restaurant');

module.exports = {
  async index(req, res) {

    const restaurants = await Restaurant.findAll({
      attributes: ['banner_path', 'restaurant_name']
    });
  
    return res.json({ restaurants });
  }
}