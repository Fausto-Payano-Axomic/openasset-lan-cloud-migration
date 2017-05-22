var DBConnection = require('./DBConnection.js');
var JsonModel = require('./JsonModel.js');
var Data = require('./DataOperations.js');
var queries = require('./sqlQueries.js');

var promise = require('co');
//using yargs to allow input from command line
var options = require('yargs')
    .usage('Usage: main.js [-h "hostname"] [-d "database name"] [-p "database port"] [-u "database username"] [-pwd "database password"]')
    .option('h', {
        alias: 'hostname',
        demand: true,
        describe: 'The hostname of the database server e.g. "localhost"'
    })
    .option('d', {
        alias: 'database',
        demand: true,
        describe: 'The name of the database e.g. "openasset_4_0"'
    })
    .option('p', {
        alias: 'port',
        demand: false,
        default: 3306,
        describe: 'Database port'
    })
    .option('u', {
        alias: 'username',
        demand: false,
        default: 'openasset',
        describe: 'Database username'
    })
    .option('pwd', {
        alias: 'password',
        demand: false,
        default: '0p3nass3t',
        describe: 'Database password'
    })
    .alias('?', 'help')
    .help('help')
    .argv;

//***end yargs configuiration***//

var host = options.h;
var database = options.d;
var port = options.p;
var user = options.u;
var password = options.pwd;

var connection = new DBConnection(host, database, port, user, password);

//globals - bad!!!
var mainQuery = [];
var imgStore = [];
var glbSettings = [];
var aliveImages = [];
// var builtInSizes = [
//     'thumbnail',
//     'webview',
//     'small',
//     'square'
// ];



/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

promise.co(function*(){

    var dbConnectionStatus = yield connection.initializeConnection();


    var result = yield Promise.all([connection.runQuery(queries.mainSqlQuery), connection.runQuery(queries.imgStoreSqlQuery),
                        connection.runQuery(queries.settingsSqlQuery), connection.runQuery(queries.countAliveImages)]);

    var dbCloseStatus = yield connection.closeConnection();


    return result;

}).then(function(result){

    print(result);

}, function(error){
    console.error(err.stack);
});



function print(vars){
    console.log(vars);
}
