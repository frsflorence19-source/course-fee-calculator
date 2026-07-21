// 课程金额计算核心逻辑（前后端共用规则，这里是后端版本，用于校验/落库）
//
// 规则：
// - USD：分期数 1-9。1-3 期手续费 +50 USD，4-7 期 +60 USD，8-9 期 +80 USD（整单只加一次，不是每期都加）
//        总额 = Main Amount + 手续费；每期应付 = 总额 / 分期数
// - SGD：分期数由用户自填（正整数）。手续费固定 +40 SGD（整单只加一次）
//        总额 = Main Amount + 40；每期应付 = 总额 / 分期数
// - MYR：Main Amount 是基础金额（通常对应 USD 报价），乘以用户手动填写的汇率 Rate 得到 MYR 总额
//        不额外加手续费。同时给出 12 期 / 24 期 / 36 期三种每期应付供参考

function usdSurcharge(installments) {
  if (installments >= 1 && installments <= 3) return 50;
  if (installments >= 4 && installments <= 7) return 60;
  if (installments >= 8 && installments <= 9) return 80;
  return null; // 超出定义范围
}

function calculate({ currency, mainAmount, installments, rate }) {
  mainAmount = Number(mainAmount);
  if (!Number.isFinite(mainAmount) || mainAmount <= 0) {
    throw new Error('Main Amount 必须是大于 0 的数字');
  }

  if (currency === 'USD') {
    installments = parseInt(installments, 10);
    if (!Number.isInteger(installments) || installments < 1 || installments > 9) {
      throw new Error('USD 分期数必须是 1 到 9 之间的整数');
    }
    const surcharge = usdSurcharge(installments);
    const total = mainAmount + surcharge;
    const perInstallment = total / installments;
    return {
      currency, mainAmount, installments,
      surcharge, total, perInstallment,
      breakdown: null,
    };
  }

  if (currency === 'SGD') {
    installments = parseInt(installments, 10);
    if (!Number.isInteger(installments) || installments < 1) {
      throw new Error('SGD 分期数必须是正整数');
    }
    const surcharge = 40;
    const total = mainAmount + surcharge;
    const perInstallment = total / installments;
    return {
      currency, mainAmount, installments,
      surcharge, total, perInstallment,
      breakdown: null,
    };
  }

  if (currency === 'MYR') {
    rate = Number(rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('MYR 需要填写大于 0 的汇率 Rate');
    }
    const total = mainAmount * rate;
    const breakdown = {
      12: total / 12,
      24: total / 24,
      36: total / 36,
    };
    return {
      currency, mainAmount, rate,
      surcharge: 0, total, perInstallment: null,
      breakdown,
    };
  }

  throw new Error('不支持的货币类型');
}

module.exports = { calculate, usdSurcharge };
