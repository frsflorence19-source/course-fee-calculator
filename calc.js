function usdSurcharge(installments) {
  if (installments >= 1 && installments <= 3) return 50;
  if (installments >= 4 && installments <= 7) return 60;
  if (installments >= 8) return 80;
  return null;
}

function roundMyrEndInDigit(value, targetDigit) {
  const base = Math.floor(value);
  const onesDigit = base % 10;
  if (onesDigit >= 1 && onesDigit <= targetDigit) return base - onesDigit + targetDigit;
  return value;
}

function roundMyrEndIn7(value) {
  return roundMyrEndInDigit(value, 7);
}

function roundMyrEndIn9(value) {
  return roundMyrEndInDigit(value, 9);
}

function calculate({ currency, mainAmount, installments, rate, deposit, isRevision }) {
  mainAmount = Number(mainAmount);
  if (!Number.isFinite(mainAmount) || mainAmount <= 0) throw new Error('Main Amount 必须是大于 0 的数字');

  deposit = deposit === undefined || deposit === null || deposit === '' ? 0 : Number(deposit);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error('Deposit 必须是大于等于 0 的数字');

  isRevision = !!isRevision;

  let base = isRevision ? mainAmount / 2 : mainAmount;
  base = base - deposit;
  if (base < 0) throw new Error(`Deposit 不能大于${isRevision ? ' Revision 半价金额' : ' Main Amount'}`);

  if (isRevision) {
    const installmentsFixed = 9;
    let total = base;
    let usedRate;
    if (currency === 'MYR') {
      usedRate = Number(rate);
      if (!Number.isFinite(usedRate) || usedRate <= 0) throw new Error('MYR 需要填写大于 0 的汇率 Rate');
      total = roundMyrEndIn9(base * usedRate);
    }
    const perInstallment = total / installmentsFixed;
    return {
      currency,
      mainAmount,
      deposit,
      isRevision: true,
      installments: installmentsFixed,
      rate: currency === 'MYR' ? usedRate : null,
      surcharge: 0,
      total,
      perInstallment,
      breakdown: null,
    };
  }

  if (currency === 'USD') {
    installments = parseInt(installments, 10);
    if (!Number.isInteger(installments) || installments < 1) {
      throw new Error('USD 分期数必须是大于等于 1 的整数');
    }
    const surcharge = usdSurcharge(installments);
    const total = base + surcharge;
    const perInstallment = total / installments;
    return {
      currency,
      mainAmount,
      deposit,
      isRevision: false,
      installments,
      rate: null,
      surcharge,
      total,
      perInstallment,
      breakdown: null,
    };
  }

  if (currency === 'SGD') {
    installments = parseInt(installments, 10);
    if (!Number.isInteger(installments) || installments < 1) {
      throw new Error('SGD 分期数必须是大于等于 1 的整数');
    }
    const surcharge = 40;
    const total = base + surcharge;
    const perInstallment = total / installments;
    return {
      currency,
      mainAmount,
      deposit,
      isRevision: false,
      installments,
      rate: null,
      surcharge,
      total,
      perInstallment,
      breakdown: null,
    };
  }

  if (currency === 'MYR') {
    rate = Number(rate);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('MYR 需要填写大于 0 的汇率 Rate');
    const rawTotal = base * rate;
    const total = roundMyrEndIn7(rawTotal);
    const breakdown = { 12: total / 12, 24: total / 24, 36: total / 36 };
    return {
      currency,
      mainAmount,
      deposit,
      isRevision: false,
      installments: null,
      rate,
      surcharge: 0,
      total,
      perInstallment: null,
      breakdown,
    };
  }

  throw new Error('不支持的货币类型');
}

module.exports = { calculate, usdSurcharge, roundMyrEndIn7, roundMyrEndIn9 };
