/**
 * buggy.java — Sample Java file with intentional bugs for Week 4 demo.
 * Contains: NullPointerException risk, String == comparison, resource leaks,
 *           empty catch blocks, integer division, thread safety issues.
 */

import java.sql.*;
import java.util.*;
import java.io.*;

public class UserService {

    // BAD: Mutable static state (thread safety issue)
    public static List<String> userCache = new ArrayList<>();  // not thread-safe

    // BAD: Hardcoded database credentials
    private static final String DB_URL  = "jdbc:mysql://localhost/mydb";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "password123";  // CRITICAL: hardcoded!

    // BAD: String comparison with == instead of .equals()
    public boolean checkRole(String role) {
        if (role == "admin") {  // BUG: always false for non-literal strings
            return true;
        }
        return false;
    }

    // BAD: Resource leak — Connection never closed if exception thrown
    public User getUser(String userId) throws SQLException {
        Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
        PreparedStatement ps = conn.prepareStatement(
            "SELECT * FROM users WHERE id = '" + userId + "'"  // CRITICAL: SQL injection
        );
        ResultSet rs = ps.executeQuery();
        if (rs.next()) {
            return new User(rs.getString("name"), rs.getString("email"));
        }
        // conn is NEVER closed — resource leak
        return null;
    }

    // BAD: Catching Exception and doing nothing (swallowed error)
    public String readConfig(String path) {
        try {
            BufferedReader reader = new BufferedReader(new FileReader(path));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            // BAD: reader never closed
            return sb.toString();
        } catch (Exception e) {
            // BAD: silently swallowed
        }
        return null;
    }

    // BAD: NullPointerException risk — no null check
    public String getUserEmail(User user) {
        return user.getEmail().toLowerCase();  // NPE if user or email is null
    }

    // BAD: Integer division truncation
    public double calculateAverage(int total, int count) {
        return total / count;  // Integer division — loses decimal precision
                               // Also: no check for count == 0 (ArithmeticException)
    }

    // BAD: Comparing Integer objects with == (auto-unboxing pitfall)
    public boolean isHighValue(Integer value) {
        return value == 1000;  // Works by chance for small values (cache -128 to 127), fails for larger
    }

    // BAD: Not thread-safe — race condition
    public void addToCache(String item) {
        if (!userCache.contains(item)) {
            userCache.add(item);  // Race condition in multi-threaded environment
        }
    }

    public static void main(String[] args) throws Exception {
        UserService service = new UserService();
        // Demonstrates SQL injection vector
        service.getUser("' OR '1'='1");
    }
}

class User {
    private String name;
    private String email;

    public User(String name, String email) {
        this.name = name;
        this.email = email;
    }

    public String getEmail() { return email; }
    public String getName()  { return name;  }
}
