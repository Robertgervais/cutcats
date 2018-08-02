import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import moment from 'moment';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import { runInvoicing } from '../reducers/invoices';

export class InvoiceRow extends React.Component {
  constructor(props) {
    super(props);

    this.handleRunInvoicing = this.handleRunInvoicing.bind(this);
  }

  handleRunInvoicing() {
    this.props.runInvoicing(this.props.periodStart, this.props.periodEnd);
  }
  
  render() {
    const periodStartStamp = new Date(this.props.periodStart).valueOf();
    const periodEndStamp = new Date(this.props.periodEnd).valueOf();
    const isInFuture = Date.now() < periodStartStamp;
    const isInPast = Date.now() > periodEndStamp;
    const isInProgress = !isInFuture && !isInPast;
    return (
      <tr>
        <td className={classnames({ 'text-secondary': isInFuture })}>
          <div>{moment(this.props.periodStart).format('MMM Do, YYYY')} - {moment(this.props.periodEnd).format('MMM Do, YYYY')}</div>
          {isInProgress && (
            <div className='text-secondary' style={{ fontSize: '.8rem' }}>Current period</div>
          )}
        </td>
        <td>
          {this.props.downloadUrl && (
            <a href={this.props.downloadUrl}>Download Invoices</a>
          )}
          {this.props.showRunInvoicing && (
            <React.Fragment>
              {isInFuture ? (
                <em className='text-secondary'>This period has not yet begun</em>
              ) : (
                <React.Fragment>
                  <Button color={isInPast ? 'primary' : 'secondary'} onClick={this.handleRunInvoicing} disabled={!isInPast}>Run invoicing</Button>
                  <a className='mx-4' href={`/api/invoices/generate?periodStart=${periodStartStamp}&periodEnd=${periodEndStamp}`} download>Dry run</a>
                </React.Fragment>
              )}
            </React.Fragment>
          )}
        </td>
      </tr>
    );
  }
}

InvoiceRow.propTypes = {
  periodStart: PropTypes.any.isRequired,
  periodEnd: PropTypes.any.isRequired,
  runInvoicing: PropTypes.func.isRequired,
  downloadUrl: PropTypes.string,
  showRunInvoicing: PropTypes.bool
};

const mapStateToProps = () => ({});

const mapDispatchToProps = {
  runInvoicing
};

export default connect(mapStateToProps, mapDispatchToProps)(InvoiceRow);
