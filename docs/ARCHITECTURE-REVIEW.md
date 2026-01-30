# 架構研究：MVVM 適用性分析

> 日期：2026-01-31
> 狀態：待團隊研究
> 來源：主人要求探討 MVVM 架構是否適合本專案

## 研究問題

1. **MVVM 是否適合影片浮水印工具？**
   - 浮水印即時拖放、透明度滑桿等需要高頻 UI 更新
   - 批次處理是後端密集操作
   - 預覽（前端 DOM）vs 輸出（後端 FFmpeg）是分離的

2. **React 生態中的 MVVM 實踐**
   - React 本身是單向資料流，如何實現 MVVM？
   - Zustand / MobX / Redux 哪個最接近 MVVM 的 ViewModel？
   - 有沒有成熟的 React MVVM 框架？

3. **替代方案比較**
   - 純 MVVM（嚴格雙向綁定）
   - MVVM-like（React hooks as ViewModel）
   - MVU（Model-View-Update，Elm 風格）
   - 目前的 React + Zustand 方案

4. **如果採用 MVVM，具體怎麼分層？**
   ```
   Model:     Rust 後端 + Zustand store（資料層）
   ViewModel: Custom hooks（業務邏輯、狀態轉換、FFmpeg 命令組裝）
   View:      React components（純渲染 + 事件觸發）
   ```

## 需要回答的問題

- [ ] MVVM 在本專案的優勢是什麼？
- [ ] MVVM 在本專案的劣勢或過度設計風險？
- [ ] 推薦的具體實作方式？
- [ ] 如果不用 MVVM，推薦什麼架構？為什麼？

---

*團隊研究後更新此文件。*
