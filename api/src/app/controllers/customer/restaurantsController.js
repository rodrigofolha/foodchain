const Restaurants = require('../../models/Restaurant');

module.exports = {
  async index(req, res) {
    const restaurants = await Restaurants.findAll({
      attributes: [
        'id',
        'restaurant_name',
        'culinary',
        'delivery_price',
        'digital_address',
        'public_key',
        'spend_public_key',
        'view_public_key',
        'latitude',
        'longitude',
        'banner_path',
      ]
    });

    return res.json(restaurants);
  }
}