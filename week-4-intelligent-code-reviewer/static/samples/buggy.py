"""
buggy.py — Sample Python file with intentional bugs for Week 4 demo.
Contains: SQL injection, bare except, hardcoded credentials, resource leak,
          mutable default arg, == None, missing type hints.
"""

import sqlite3
import hashlib

# BAD: Hardcoded credentials
DB_PASSWORD = "admin123"
SECRET_KEY  = "supersecretkey"

# BAD: Mutable default argument
def get_user_data(user_id, fields=[]):
    fields.append("id")  # Mutates shared default!
    return fields


# BAD: SQL injection vulnerability
def login(username, password, db_path="users.db"):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # CRITICAL: Direct string formatting — injectable
    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
    cursor.execute(query)

    result = cursor.fetchone()
    # BAD: connection never closed (resource leak)
    return result


# BAD: Bare except swallows all errors silently
def parse_config(config_file):
    try:
        with open(config_file) as f:
            data = f.read()
        return eval(data)      # BAD: eval() is dangerous
    except:
        pass


# BAD: == None comparison, no input validation
def calculate_discount(price, discount=None):
    if discount == None:       # should be "is None"
        discount = 0

    # BAD: no validation — negative discount not checked
    return price - (price * discount / 100)


# BAD: MD5 for password hashing (weak)
def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()


# BAD: Inefficient — O(n²) instead of O(n)
def find_duplicates(lst):
    duplicates = []
    for i in range(len(lst)):
        for j in range(len(lst)):
            if i != j and lst[i] == lst[j] and lst[i] not in duplicates:
                duplicates.append(lst[i])
    return duplicates


if __name__ == "__main__":
    print(login("admin", "' OR '1'='1"))
