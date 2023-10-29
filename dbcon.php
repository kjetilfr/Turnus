<!DOCTYPE html>
<html>
<head>
    <title>Data Input and Display</title>
</head>
<body>

<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Process form submission and insert data into the database
    $conn = new mysqli("your_database_host", "your_database_user", "your_database_password", "your_database_name");

    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    $name = $_POST['name'];
    $start_time = $_POST['start_time'];
    $end_time = $_POST['end_time'];

    $sql = "INSERT INTO your_table (name, start_time, end_time) VALUES ('$name', '$start_time', '$end_time')";

    if ($conn->query($sql) === TRUE) {
        echo "Data inserted successfully";
    } else {
        echo "Error: " . $sql . "<br>" . $conn->error;
    }

    $conn->close();
}
?>

<h1>Data Input</h1>
<form action="<?php echo $_SERVER['PHP_SELF']; ?>" method="post">
    Name: <input type="text" name="name"><br>
    Start Time: <input type="text" name="start_time"><br>
    End Time: <input type="text" name="end_time"><br>
    <input type="submit" value="Submit">
</form>

<h1>Result</h1>

<?php
// Retrieve and display data from the database
$conn = new mysqli("your_database_host", "your_database_user", "your_database_password", "your_database_name");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$sql = "SELECT * FROM your_table";
$result = $conn->query($sql);

if ($result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        echo "Name: " . $row['name'] . "<br>";
        echo "Start Time: " . $row['start_time'] . "<br>";
        echo "End Time: " . $row['end_time'] . "<br>";
        echo "<hr>";
    }
} else {
    echo "No data found in the database.";
}

$conn->close();
?>
</body>
</html>
