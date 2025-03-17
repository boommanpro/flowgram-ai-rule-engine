import styled from 'styled-components';

export const FormOutputsContainer = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  border-top: 1px solid var(--semi-color-border);
  width: 100%;
  padding: 10px 10px 10px;
  background: #f4f4ff;

  :global(.semi-tag .semi-tag-content) {
    font-size: 10px;
  }
`;
