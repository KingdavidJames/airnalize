// walletAddress = "0x8861186D9513cFD5d1bEb199355448Ce5E96F105"
// export function chartPie() {
//     const netWalletBalance = parseFloat(document.getElementById("netWalletBalance").textContent) || 0;
//     const tbAst = parseFloat(document.getElementById("tbAst").textContent) || 0;
//     const tbHbr = parseFloat(document.getElementById("tbHbr").textContent) || 0;
//     const tbUsdc = parseFloat(document.getElementById("tbUsdc").textContent) || 0;

//     console.log("Chart Data:", netWalletBalance, tbAst, tbHbr, tbUsdc); // ✅ Debug log

//     var options = {
//         series: [netWalletBalance, tbAst, tbHbr, tbUsdc],
//         chart: {
//             width: 380,
//             type: 'pie',
//         },
//         labels: ['$AMB', '$AST', '$HBR', '$USDC'],
//         responsive: [{
//             breakpoint: 480,
//             options: {
//                 chart: {
//                     width: 200
//                 },
//                 legend: {
//                     position: 'bottom'
//                 }
//             }
//         }]
//     };

//     var chart = new ApexCharts(document.querySelector("#idChartPie"), options);
//     chart.render();
// }



// var optionsNew = {
//     series: [44, 55, 13, 43, 22],
//     chart: {
//     width: 380,
//     type: 'pie',
//   },
//   labels: ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'],
//   responsive: [{
//     breakpoint: 480,
//     options: {
//       chart: {
//         width: 200
//       },
//       legend: {
//         position: 'bottom'
//       }
//     }
//   }]
//   };

//   var chart = new ApexCharts(document.querySelector("#idChartPieSecond"), optionsNew);
//   chart.render();