/**
 * buggy.js — Sample JavaScript file with intentional bugs for Week 4 demo.
 * Contains: XSS, == vs ===, var hoisting, missing error handling,
 *           prototype pollution, unhandled promises, global variables.
 */

// BAD: Global variable pollution
var userData = {};
var API_KEY = "sk-live-abc123xyz789";  // Hardcoded secret!

// BAD: XSS vulnerability — directly sets innerHTML from user input
function displayUserMessage(message) {
    document.getElementById("output").innerHTML = message;  // CRITICAL: XSS
}

// BAD: == instead of === (type coercion issues)
function isAdmin(role) {
    if (role == 1) {        // '1' == 1 is true (unexpected coercion)
        return true;
    }
    return false;
}

// BAD: var hoisting confusion
function processItems(items) {
    for (var i = 0; i < items.length; i++) {
        setTimeout(function() {
            console.log(items[i]);  // Always logs undefined (var is function-scoped)
        }, 100);
    }
}

// BAD: Unhandled Promise rejection
async function fetchUserData(userId) {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();  // No error check for failed response
    return data;
}

// BAD: Prototype pollution vulnerability
function mergeObjects(target, source) {
    for (let key in source) {
        target[key] = source[key];  // CRITICAL: allows __proto__ pollution
    }
    return target;
}

// BAD: Missing null checks — will throw TypeError
function getUserDisplayName(user) {
    return user.profile.displayName.toUpperCase();  // crashes if any is null
}

// BAD: No input validation, NaN not handled
function calculateAge(birthYear) {
    const age = new Date().getFullYear() - birthYear;
    return age;  // Returns NaN if birthYear is undefined
}

// BAD: Callback hell, no error handling
function loadAllData(userId, callback) {
    fetchUserData(userId, function(user) {
        fetchOrders(user.id, function(orders) {
            fetchPayments(orders[0].id, function(payment) {
                callback(payment);
                // No error handling at any level
            });
        });
    });
}

module.exports = { displayUserMessage, isAdmin, mergeObjects };
