OpenAsset Lan-Cloud Migration Node App
======================================

## Prerequisites
As this tool requires an external MySQL database connection to be created you have to comment out the ```skip-networking``` line
in your *my.ini* file located at C:\MySql5\my.ini on Windows then restart the MySQL service. Haven't found another way round this yet.

## To run
1. Install Node (v4.3.1) and NPM and run ```npm install```
2. Modify the database connection settings located at the top of *main.js*:
```js
var host = 'localhost';
var database = 'ABC001'
var port = 3306;
var user = 'openasset';
var password = '0p3nass3t';
```
3. Save and run ```npm run test``` This will output a JSON file of all the orignal image info from your database to your current working diorectory
