<!-- 
<h4 align="center">
<img src="https://wearesocial-net.s3.amazonaws.com/us/wp-content/uploads/sites/7/2019/05/WAS_NYC_WEB_LOGOSUber-Eats.png" width="250px"/><br>
 <b>Food delivery system based on blockchain</b>
</h4>
<p align="center">
   <a href="https://github.com/joaovitorzv"><img alt="Made by Joao vitor" src="https://img.shields.io/badge/made%20by-joao-red"></a>
   <a href="https://github.com/joaovitorzv/UberEats/blob/develop/LICENSE"><img alt="License" src="https://img.shields.io/github/license/joaovitorzv/UberEats?style=flat-square"></a>
   <a href="https://github.com/joaovitorzv/UberEats"><img alt="Stars" src="https://img.shields.io/github/stars/joaovitorzv/ubereats?style=social">
</p></a> <br>-->

### Screenshots  📷

*Restaurant manager*
<p float="left">
 <img src="/screenshots/signup-page.png" align="middle" width="380px"/>
 <img src="/screenshots/menu-manager-page.png" align="middle" width="380px"/>
</p>

*Customer*

<p float="left">
 <img src="/screenshots/home-customer-page.png" align="middle" width="380px"/>
 <img src="/screenshots/restaurant-customer-page.png" align="middle" width="380px"/>
</p> -->

*Delivery worker*

<p float="left">
 <img src="/screenshots/home-customer-page.png" align="middle" width="380px"/>
 <img src="/screenshots/restaurant-customer-page.png" align="middle" width="380px"/>
</p>



### :rocket: Techs
This project was developed using the following technologies:
- [Node.js](https://nodejs.org/en/)
- [Express](https://expressjs.com/pt-br/)
- [Socket.io](https://socket.io/)
- [JWT](https://jwt.io/)
- [Formik](https://github.com/jaredpalmer/formik)
- [Yup](https://github.com/jquense/yup)
- [React](https://github.com/facebook/react)
- [React Native](https://github.com/facebook/react-native)
- [Styled Components](https://styled-components.com/)
- [Web3.js](https://github.com/ChainSafe/web3.js)

### :muscle: The project

The main idea is to democratize the food delivery service, connecting several restaurants, delivery people and customers without the need to charge fees.

### 💡 Main features
<hr> 

- <b>Web version (For restaurants)</b>
	- Register user
	- Register menu items
	- Accept orders in real time
- <b>Web version (For customers)</b>
	- See all restaurants and menu
	- Make and pay for an order
	- Monitor the order status (real time)
- <b>Web version (For delivery workers)</b>
	- See the available orders for delivery
	- Pick an order (real time)

### 🎯 Goals
The main goal of this project is connecting directly the actors giving them autonomy. Moreover, all process must be transparent but all sensitive data must not be exposed.
No comission fees
No sensitive data storage
Every information can be tracked on blockchain network


### 🔥 How to run this project
***To run API***

You must create a postgres docker container or run the docker-compose in root folder.
```sh
$ docker run --name packfood_db -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
```
OR
```sh
$ docker-compose -f ./docker-compose.yml up -d
```

Install the packages run migrations and start API

```sh
$ yarn install
$ yarn sequelize db:migrate
$ yarn dev
```
Dont forgot to configure the ``.env`` environment you can found the example of the variables [Here](api/.env)


***To run Frontend***
```sh
$ yarn install
$ yarn start
```

***To configure Metamask to conncet to Fantom testnet***

1. Install metamask extension to your chrome compatible browser (Chrome, Opera, Brave, Firefox, Kiwi).
2. After you must add Fantom testnet connection to your Metamask
3. Network Name: Fantom testnet
4. New RPC Url: https://rpc.testnet.fantom.network/
5. ChainID: 0xfa2
6. Symbol: FTM
7. Block Explorer URL: https://testnet.ftmscan.com/
8. Finnaly, access the testnet faucet at https://faucet.fantom.network/ to request some testnet FTM.


### :memo: License

This project is unde MIT license. See the file [LICENSE](https://github.com/rodrigofolha/pack-food/blob/develop/LICENSE) to more details.

<p align="center">Thanks to <strong>João vitor oliveira </strong> for template 👋</p>
