function hash(string) {
    var hash = 0;
    for (var i = 0; i < string.length; i++) {
        var char = string.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

function getAllIndices(arr, val) {
    var indexes = [], i;
    for(i = 0; i < arr.length; i++)
        if (arr[i] === val)
        indexes.push(i);
    return indexes;
}

function undefinedToEmpty(string) {
    if (string === undefined) {
        return "";
    }
    return string
}