var mysql = require('mysql');

function DBConnection(host, database, port, user, password){
    this.host = host,
    this.database = database,
    this.port = port,
    this.user = user,
    this.password = password
    this.DBConnection = '';
}

DBConnection.prototype.initializeConnection = function(){
    var self = this;
    return new Promise(function(resolve, reject){

        //details for database to connect to
        self.DBConnection = mysql.createConnection({
            host: self.host,
            database: self.database,
            port: self.port,
            user: self.user,
            password: self.password
        });

        //connect to database
        //console.log('Connecting to database ' + self.database + '...');

        self.DBConnection.connect(function(error){
            if(error){
                reject({
                    code: error.code,
                    message: 'There was an error connecting to the database: ' + error
                });
            }
            resolve('Connection to database ' + self.database + ' established!');
        });

    });
}

DBConnection.prototype.runQuery = function(sqlQuery){
    var self = this;
    return new Promise(function(resolve, reject){

        self.DBConnection.query(sqlQuery, function(error, queryResult){
            if(error){
                reject({
                    code: error.code,
                    message: 'There was an error running the query: ' + error
                });
            }
            resolve(queryResult);
        });

    });
}

DBConnection.prototype.closeConnection = function(){
    var self = this;
    return new Promise(function(resolve, reject){

        self.DBConnection.end(function(error){
            if(error){
                reject({
                    code: error.code,
                    message: 'Error closing database connection: ' + error
                });
            }
            resolve('Database connection closed successfully');
        });

    });
}


module.exports = DBConnection;
