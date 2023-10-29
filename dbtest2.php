<!DOCTYPE html>
<html>
<head>
    <title>Data Input, Save, and Load Grids</title>
    <style>
        .grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            grid-gap: 5px;
        }

        .grid-item {
            padding: 10px;
            border: 1px solid #ccc;
            text-align: center;
        }
    </style>
</head>
<body>

<?php
$conn = new mysqli("your_database_host", "your_database_user", "your_database_password", "your_database_name");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    if (isset($_POST['grid_data'])) {
        $gridName = $_POST['grid_name'];
        $gridData = $_POST['grid_data'];

        $sql = "INSERT INTO saved_grids (grid_name, grid_data) VALUES ('$gridName', '$gridData')";

        if ($conn->query($sql) === TRUE) {
            echo "Grid '$gridName' saved successfully";
        } else {
            echo "Error: " . $sql . "<br>" . $conn->error;
        }
    }
}

if (isset($_GET['grid_name'])) {
    $selectedGridName = $_GET['grid_name'];

    $sql = "SELECT grid_data FROM saved_grids WHERE grid_name = '$selectedGridName'";
    $result = $conn->query($sql);

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $gridData = json_decode($row['grid_data']);

        echo "<h1>Grid: $selectedGridName</h1>";
        echo '<div class="grid">';
        foreach ($gridData as $gridItem) {
            echo '<div class="grid-item">' . $gridItem . '</div>';
        }
        echo '</div>';
    } else {
        echo "Grid data not found.";
    }
}
?>

<h1>Data Input</h1>
<form action="<?php echo $_SERVER['PHP_SELF']; ?>" method="post">
    Name: <input type="text" name="name"><br>
    Start Time: <input type="text" name="start_time"><br>
    End Time: <input type="text" name="end_time"><br>
    <input type="submit" value="Submit">
</form>

<h1>Add Names to Grid</h1>
<form action="<?php echo $_SERVER['PHP_SELF']; ?>" method="post">
    <select name="grid_names">
        <?php
        $sql = "SELECT name FROM your_table";
        $result = $conn->query($sql);

        if ($result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                echo '<option value="' . $row['name'] . '">' . $row['name'] . '</option>';
            }
        } else {
            echo '<option value="">No names found</option>';
        }
        ?>
    </select>
    <input type="submit" value="Add to Grid">
</form>

<h1>Saved Grids</h1>
<ul>
    <?php
    $sql = "SELECT grid_name FROM saved_grids";
    $result = $conn->query($sql);

    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            echo '<li><a href="?grid_name=' . $row['grid_name'] . '">' . $row['grid_name'] . '</a></li>';
        }
    } else {
        echo "No saved grids found.";
    }
    ?>
</ul>

<h1>Grid</h1>
<div class="grid">
    <?php
    if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['grid_names'])) {
        $grid_name = $_POST['grid_names'];
        echo '<div class="grid-item">' . $grid_name . '</div>';
    }
    ?>
</div>

<h1>Save Grid</h1>
<form action="<?php echo $_SERVER['PHP_SELF']; ?>" method="post">
    <input type="text" name="grid_name" placeholder="Grid Name">
    <input type="hidden" name="grid_data" id="grid_data">
    <input type="button" value="Save Grid" onclick="saveGrid()">
</form>

<script>
    function saveGrid() {
        var gridItems = document.querySelectorAll(".grid-item");
        var gridData = [];

        gridItems.forEach(function (item) {
            gridData.push(item.textContent);
        });

        document.getElementById("grid_data").value = JSON.stringify(gridData);
        document.forms[0].submit();
    }
</script>

</body>
</html>
