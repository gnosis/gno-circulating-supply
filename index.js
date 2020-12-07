const Web3 = require('web3')
const debug = require('debug')('index.js')
const S3 = require('aws-sdk/clients/s3')
const erc20ABI = require('./erc20ABI.json')

require('dotenv').config()

const nodeUrl = process.env.NODE_URL

const awsID = process.env.AWS_ID
const awsSecret = process.env.AWS_SECRET
const bucketName = process.env.BUCKET_NAME

const gnoAddress = "0x6810e776880C02933D47DB1b9fc05908e5386b96"
const vestingDAO = "0xeC83f750adfe0e52A8b0DbA6eeB6be5Ba0beE535"
const vestingLTD = "0x604e4557e9020841f4e8EB98148DE3D3cDEA350c"

async function run(){

    // Validations
    if(!nodeUrl){
        debug("MNEMONIC and NODE_URL cannot be null");
        process.exit(1)
    }

    // AWS S3 Validations
    if(!awsID || !awsSecret || !bucketName){
        debug("AWS_ID, AWS_SECRET and BUCKET_NAME cannot be null");
        process.exit(1)
    }

    const web3 = new Web3( nodeUrl);

    // Check web3 connection works
    let blockNumber
    try{
        blockNumber = await web3.eth.getBlockNumber()
    }
    catch(e){
        debug("NODE_URL doesn't seem to be a valid Ethereum RPC endpoint")
    }

    
    // Do the business
    const gno = new web3.eth.Contract(erc20ABI, gnoAddress)
    const gnoSupply = web3.utils.toBN(await gno.methods.totalSupply().call())

    debug(`totalSupply: ${gnoSupply.toString()}`)

    const daoVestingBalance = web3.utils.toBN(await gno.methods.balanceOf(vestingDAO).call())
    const ltdVestingBalance = web3.utils.toBN(await gno.methods.balanceOf(vestingLTD).call())

    debug(`daoVestingBalance: ${daoVestingBalance.toString()}`)
    debug(`ltdVestingBalance: ${ltdVestingBalance.toString()}`)

    const circulatingSupply = gnoSupply.sub(daoVestingBalance).sub(ltdVestingBalance)
    const circulatingSupplyInteger = Math.floor(web3.utils.fromWei(circulatingSupply, 'ether'));

    debug(`circulatingSupply: ${circulatingSupply.toString()}`)
    debug(`circulatingSupplyInteger: ${circulatingSupplyInteger.toString()}`)

    // Small check to prevent uploading buggy numbers
    if(circulatingSupplyInteger < 1.5e6){
        debug("Circulating supply cannot be correct, will ignore the S3 upload")
        process.exit(1)
    }

    // Upload result to S3
    debug("upload result to S3")
    const s3 = new S3({
        accessKeyId: awsID,
        secretAccessKey: awsSecret
    });

    // Setting up S3 upload parameters
    const params = {
        Bucket: bucketName,
        Key: 'index',
        Body: circulatingSupplyInteger.toString(),
        ContentType: "text/plain"
    };

    s3.upload(params, function(err, data) {
        if (err) {
            throw err
        }
        debug(`File uploaded successfully. ${data.Location}`)
    });

}

run()
