const fetchData = async (url, method = 'GET', body = null,callback=()=>{}) => {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${encodeURIComponent(localStorage.getItem('token'))}` 
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    let data = await fetch(url, options);
    let response = await data.json();
    callback(response);
    
}

// Example usage for GET request
// fetchData('/api/users/3', 'GET',null,(response)=>{console.log(response)});

// Example usage for POST request
fetchData('/api/users', 'POST', {
    username: 'sd',
    password: 'password'
},(response)=>{console.log(response)});

// fetchData('/auth/login', 'POST', {
//     username: 'sd',
//     password: 'password'
// },(response)=>{localStorage.setItem('token',response.token);console.log(localStorage.getItem('token'))});       

fetchData('/api/users/sd', 'GET',null,(response)=>{console.log(response)});