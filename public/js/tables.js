new gridjs.Grid({
    columns: [
      "Blocks",
      { 
        name: "Hash",
        formatter: (cell) => gridjs.html(`<a href="https://explorer.airdao.io/tx/${cell}" style="font-weight:bold; text-decoration:underline; color:#000;">${cell}</a>`)
      },
      "From",
      "To",
      "Amount",
      "Date"
    ],
    pagination: true,
    data: [
        ["65822", "0xa1b2c3...d4e5", "0xf6g7h8i9j0k1l2...m3n4", "0xf6g7h8i9j0k1l2...m3n4", "320 AMB", "12-03-2025"],
        ["65931", "0xb7c8d9...e0f1", "0x1a2b3c4d5e6f7g...8h9i", "0x1a2b3c4d5e6f7g...8h9i", "890 AMB", "18-02-2025"],
        ["66043", "0xe5f6g7...h8i9", "0x0a1b2c3d4e5f6g...7h8i", "0x0a1b2c3d4e5f6g...7h8i", "475 AMB", "25-02-2025"],
        ["66211", "0x123456...7890", "0xaabbccddeeff00...1122", "0xaabbccddeeff00...1122", "642 AMB", "08-02-2025"],
        ["66459", "0xabcdef...1234", "0x5566778899aabb...ccdd", "0x5566778899aabb...ccdd", "930 AMB", "15-03-2025"],
        ["66612", "0x789abc...def0", "0x33445566778899...aabb", "0x33445566778899...aabb", "500 AMB", "01-03-2025"],
        ["66734", "0x0f1e2d...3c4b", "0x9876543210fedc...ba98", "0x9876543210fedc...ba98", "150 AMB", "22-02-2025"],
        ["66980", "0x654321...fedc", "0x11223344556677...8899", "0x11223344556677...8899", "810 AMB", "14-02-2025"],
        ["67123", "0xfedcba...9876", "0xabc123def456ghi...789j", "0xabc123def456ghi...789j", "275 AMB", "27-02-2025"],
        ["67345", "0xabcdef...6543", "0x987abcdef123456...7890", "0x987abcdef123456...7890", "420 AMB", "03-03-2025"],
        ["67511", "0x123abc...456def", "0x111222333444555...6667", "0x111222333444555...6667", "675 AMB", "10-03-2025"],
        ["67789", "0x456def...123abc", "0x888999aaa111222...3334", "0x888999aaa111222...3334", "340 AMB", "19-02-2025"],
        ["67954", "0xabcdef...789123", "0x555666777888999...0001", "0x555666777888999...0001", "980 AMB", "28-02-2025"],
        ["68112", "0x0a1b2c...3d4e", "0x9a8b7c6d5e4f3g...2h1i", "0x9a8b7c6d5e4f3g...2h1i", "123 AMB", "07-02-2025"],
        ["68276", "0x123456...abcdef", "0xfedcba987654321...0fed", "0xfedcba987654321...0fed", "789 AMB", "21-02-2025"],
        ["68400", "0xa1b2c3...d4e5", "0xf0e9d8c7b6a5f4...3210", "0xf0e9d8c7b6a5f4...3210", "600 AMB", "05-03-2025"],
        ["68533", "0xb7c8d9...e0f1", "0x123abc456def789...0123", "0x123abc456def789...0123", "450 AMB", "16-02-2025"],
        ["68745", "0xe5f6g7...h8i9", "0xaabbccddeeff00...1122", "0xaabbccddeeff00...1122", "275 AMB", "26-02-2025"],
        ["68901", "0x123456...7890", "0x33445566778899...aabb", "0x33445566778899...aabb", "980 AMB", "02-03-2025"],
        ["69028", "0xabcdef...1234", "0x111222333444555...6667", "0x111222333444555...6667", "330 AMB", "09-02-2025"]
      ],      
    style: {
      table: {
        border: "none"
      },
      th: {
        "background-color": "#031835",
        "text-align": "center",
        // padding: "20px 24px",
        color: "#E3EFFF",
        border: "none"
      },
      td: {
        "text-align": "center",
        "background-color": "#E3EFFF"
      },
      tbody: {
        "background-color": "#E6E6E6"
      }
    }
  }).render(document.getElementById("tables"));
  