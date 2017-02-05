//TODO: Could change this to use revealing module pattern so values can't be
//set by going 'json.database' etc

function JsonModel(object){
    for(var key in object){
        if(object.hasOwnProperty(key)){
            this[key] = object[key];
        }
    }
}

JsonModel.prototype.addItem = function(item, value){
    if(Array.isArray(this[item])){
        this[item].push(value);
    } else {
        this[item] = value;
    }   
}

JsonModel.prototype.getItem = function(item){
    return this[item];
}


module.exports = JsonModel;