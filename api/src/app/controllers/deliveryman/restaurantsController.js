const Restaurant = require('../../models/Restaurant');

module.exports = {
  async index(req, res) {
    const digital_address = req.params.digital_address;
    const restaurant = await Restaurant.findOne({
      where: { digital_address: digital_address },
      attributes: [
        'id',
        'restaurant_name',
        'restaurant_address',
        'culinary',
        'delivery_price',
        'digital_address',
        'banner_path',
      ]
    });
    return res.json(restaurant);
  }
}