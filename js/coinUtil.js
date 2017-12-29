const currencyList = require("./currencyList.js")
const bcLib = require('bitcoinjs-lib')
const bip39 = require("bip39")
const crypto = require('crypto');
const storage = require("./storage")
const errors=require("./errors")


exports.DEFAULT_LABEL_NAME = "Default"
exports.GAP_LIMIT=20
exports.GAP_LIMIT_FOR_CHANGE=20

exports.isValidAddress=(addr)=>{
  try{
    bcLib.address.fromBase58Check(addr)
    return true
  }catch(e){
    return false
  }
};
exports.getPrice=(cryptoId,fiatId)=>{
  let currencyPath = []
  let prevId =cryptoId;//reverse seek is not implemented
  while(prevId!==fiatId){
    currencyPath.push(currencyList.get(prevId).getPrice())
    prevId=currencyList.get(prevId).price.fiat
  }
  return Promise.all(currencyPath).then(v=>{
    let price=1
    v.forEach(p=>{
      price*=p
    })
    return price
  })
}
exports.encrypt=(plain,password)=>{
  const cipher = crypto.createCipher('aes256', password);
  return cipher.update(plain, 'utf8', 'hex')+cipher.final('hex');
}
exports.decrypt=(cipher,password)=>{
  const decipher = crypto.createDecipher('aes256', password);
  return decipher.update(cipher, 'hex', 'utf8')+decipher.final('utf8');
}

exports.makePairsAndEncrypt=(option)=>new Promise((resolve, reject) => {
  let seed;
  let entropy;
  if(option.entropy){
    entropy=option.entropy
    seed=bip39.mnemonicToSeed(bip39.entropyToMnemonic(option.entropy))
  }else if(option.mnemonic){
    entropy=bip39.mnemonicToEntropy(option.mnemonic)
    seed=bip39.mnemonicToSeed(option.mnemonic)
  }else {
    throw new Error("Can't generate entropy")
  }
  if(option.encryptPub){
    resolve({entropy:exports.encrypt(entropy, option.password)})
  }else{
    const ret ={
      entropy:"",
      pubs:{}
    }
    for(let i=0;i<option.makeCur.length;i++){
      let coinId = option.makeCur[i]
      let pub =currencyList.get(coinId).seedToPubB58(seed)
      ret.pubs[coinId]=pub
    }
    
    ret.entropy=exports.encrypt(entropy, option.password);
    resolve(ret)

  }
});


exports.decryptKeys=(option)=>new Promise((resolve, reject) => {
  let seed=
      bip39.mnemonicToSeed(
        bip39.entropyToMnemonic(
          exports.decrypt(option.entropyCipher,option.password)
        )
      )
  
  const ret = {}
  for(let i=0;i<option.makeCur.length;i++){
    let coinId = option.makeCur[i]
    const pub=currencyList.get(coinId).seedToPubB58(seed)
    ret[coinId]=pub
  }
});

exports.createLabel=(cId,name)=>{
  console.warn("Currency.createLabel is deprecated")
  return currencyList.get(cId).createLabel(name)
}


exports.updateLabel=(cId,name,newName)=>{
  console.warn("Currency.updateLabel is deprecated")
  return currencyList.get(cId).updateLabel(name,newName)
}

exports.getLabels=(cId)=>{
  console.warn("Currency.getLabels is deprecated")
  return currencyList.get(cId).getLabels()
}
  
exports.copy=data=>{

}

exports.getBip21=(bip21Urn,address,query)=>{
  let queryStr="?"
  for(let v in query){
    if(query[v]){
      queryStr+=encodeURIComponent(v)+"="+encodeURIComponent(query[v])+"&"
    }
  }
  return bip21Urn+":"+address+queryStr
};

exports.parseUrl=url=>new Promise((resolve,reject)=>{
  const raw=new URL(url)
  const ret = {
    url,
    raw,
    protocol:raw.protocol.slice(0,-1),
    isCoinAddress:false,
    isPrefixOk:false,
    isValidAddress:false,
    coinId:"",
    address:"",
    message:"",
    amount:0,
    opReturn:"",
    label:""
  }
  currencyList.each(v=>{
    if(v.bip21===ret.protocol){
      ret.isCoinAddress=true
      ret.coinId=v.coinId
      ret.address=raw.pathname
      for(let i=v.prefixes.length-1;i>=0;i--){
        if(v.prefixes[i]===ret.address[0]){
          ret.isPrefixOk=true
          break
        }
      }
      ret.isValidAddress=exports.isValidAddress(ret.address)
      ret.message=raw.searchParams.get("message")
      ret.label=raw.searchParams.get("label")
      ret.amount=raw.searchParams.get("amount")
      ret.opReturn=raw.searchParams.get("req-opreturn")
    }
  })
  
  resolve(ret)
})

exports.proxyUrl=url=>{
  return 'http://localhost:4545/proxy/'+encodeURIComponent(url)
}
exports.shortWait=()=>new Promise(r=>{
  setTimeout(r,150)
})